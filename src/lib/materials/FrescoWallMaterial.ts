import type {FrescoLayout} from '../gallery/fresco.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, max, mix, mx_noise_float, normalLocal, positionLocal, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {pompeianFresco} from '../gallery/fresco.ts'
import {heightNormal, inside, line, visibleDetail} from './filters.ts'

type Float = Node<'float'>

const palette = {
  deep: hsl.integer(30, 86, 30),
  light: hsl.integer(31, 81, 42),
  black: hsl.integer(34, 8, 10),
  blackLight: hsl.integer(36, 11, 16),
  ochre: hsl.integer(80, 72, 70.5),
}

/**
 * Lime fresco in the Pompeian manner, painted on one wall: a black socle under a field of cinnabar red, black bands dividing the field into panels, an ochre fillet along the socle, an ochre stalk down every band and an ochre line framing every panel, and a black frieze under the cornice.
 *
 * It is painted in the wall’s own coordinates, so a wall’s bands and panels are laid out around its openings, see `frescoLayout`; only the face into the room is painted, the reveals of its openings stay plain red. The red is burnished lime: soft clouds of two reds under a fine grain, with a little sheen. Lines are filtered against the pixel footprint and thin to their average before they could shimmer.
 * On a curved wall, given its `curveRadius`, the coordinates run along its curve; round a ring, the wash takes no notice of the seam where its ends meet, and the bands and panels go on through it.
 */
export default class FrescoWallMaterial extends MeshStandardNodeMaterial {
  constructor({bands, panels, period, curveRadius}: FrescoLayout & {
    /** the wall’s signed bend radius, if it curves */
    curveRadius?: number
  }) {
    super({
      roughness: 0.5,
      metalness: 0,
      envMapIntensity: 0.35,
    })
    const {socle, fillet, band, stalk, frieze, frameInset, frameRise, frameLine} = pompeianFresco
    const {x, y: height, z} = positionLocal
    // Bent, a point of the wall turned this far round the center of its bend, which lies at z = radius in front of the wall’s middle.
    const turn = curveRadius ? atan(x.div(curveRadius), float(1).sub(z.div(curveRadius))).toVar('frescoTurn') : float(0)
    const u = (curveRadius ? turn.mul(curveRadius) : x).toVar('frescoU')
    const y = height.toVar('frescoY')
    // The face looks back toward the center of the bend, wherever it has turned round it.
    const face = (curveRadius ? normalLocal.xz.dot(vec2(turn.sin().negate(), turn.cos())) : normalLocal.z).greaterThan(0.5).toVar('frescoFace')
    /** how far along the wall a point lies from `at`, the short way round a ring */
    const from = (at: Node<'float'> | number) => {
      const offset = u.sub(at)
      return period ? offset.sub(offset.div(period).round().mul(period)) : offset
    }
    // Along a curve, the wash is laid out in space, which goes on smoothly through a ring’s seam, where the coordinate along it jumps.
    const washed = curveRadius ? vec3(x, y, z) : vec3(u, y, 0)
    const footprint = max(washed.x.fwidth(), washed.y.fwidth(), washed.z.fwidth()).toVar('frescoFootprint')
    const fineDetail = visibleDetail(footprint, 0.02)
    // Lime wash: soft clouds at two scales and a fine grain.
    const clouds = mx_noise_float(washed.mul(0.45).add(vec3(0, 0, 2.3))).mul(0.6).add(mx_noise_float(washed.mul(1.9).add(vec3(0, 0, 5.1))).mul(0.4)).mul(0.5).add(0.5).toVar('frescoClouds')
    const grain = mx_noise_float(washed.mul(45).add(vec3(0, 0, 8.8))).toVar('frescoGrain')
    const red = mix(color(palette.deep), color(palette.light), clouds.smoothstep(0.15, 0.9)).mul(grain.mul(0.03).mul(fineDetail).add(1))
    const black = mix(color(palette.black), color(palette.blackLight), clouds)
    // the field between the socle’s fillet and the frieze, where the bands, stalks and frames are painted
    const fieldBottom = socle + fillet
    const inField = y.greaterThan(fieldBottom).and(y.lessThan(frieze[0]))
    const isSocle = y.lessThan(socle)
    const isFrieze = y.greaterThan(frieze[0]).and(y.lessThan(frieze[1]))
    let inBand: Float = float(0)
    let stalks: Float = float(0)
    for (const at of bands) {
      inBand = max(inBand, inside(from(at).abs().sub(band / 2)))
      stalks = max(stalks, line(from(at), stalk / 2))
    }
    // a line along the socle’s top, along both edges of the frieze and round every panel
    const socleFillet = inside(y.sub(socle + fillet / 2).abs().sub(fillet / 2))
    const friezeFillets = max(line(y.sub(frieze[0] + 0.03), 0.004), line(y.sub(frieze[1] - 0.03), 0.004))
    let frames: Float = float(0)
    const frameBottom = fieldBottom + frameRise
    const frameTop = frieze[0] - frameRise
    for (const {u: [start, end], pierced} of panels) {
      if (pierced || end - start < frameInset * 2 + 0.3) {
        continue
      }
      const halfWidth = (end - start) / 2 - frameInset
      const halfHeight = (frameTop - frameBottom) / 2
      const edge = max(from((start + end) / 2).abs().sub(halfWidth), y.sub((frameBottom + frameTop) / 2).abs().sub(halfHeight))
      frames = max(frames, line(edge, frameLine / 2))
    }
    const dark = select(isSocle.or(isFrieze), float(1), inBand.mul(select(inField, float(1), float(0))))
    const ochre = max(max(socleFillet, select(isFrieze, friezeFillets, float(0))), select(inField, max(stalks.mul(inBand), frames), float(0)))
    // Hand-painted: the lines lie a little thinner in places.
    const wear = mx_noise_float(washed.mul(2.7).add(vec3(0, 0, 11.4))).mul(0.5).add(0.5).smoothstep(0.1, 0.9).mul(0.25).add(0.75)
    const painted = mix(mix(red, black, dark), color(palette.ochre), ochre.mul(wear))
    this.colorNode = select(face, painted, red)
    // Burnished lime: the red a little glossier where the clouds are light, the black socle duller, the ochre lines matte.
    this.roughnessNode = select(face, mix(float(0.56).sub(clouds.mul(0.12)), float(0.62), max(dark.mul(0.6), ochre)), float(0.5))
    this.normalNode = heightNormal(grain.mul(0.00006).mul(fineDetail))
  }
}
