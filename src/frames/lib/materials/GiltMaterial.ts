import type {FrameSurface} from './frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {clamp, color, float, max, mix, mx_noise_float, mx_worley_noise_float, smoothstep, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import {frameSurface as readSurface} from './frameAttributes.ts'
import frameStudio from './frameStudio.ts'

/** carving cut into the gilding, in meters of height over the surface, and how deep it cuts at most, which tells its hollows from its crests */
export type GiltRelief = {
  depth: number
  height: (surface: FrameSurface) => Float
}

export type GiltOptions = {
  /** the red clay the leaf is laid on, which shows where it is rubbed through */
  bole?: string
  /** how strongly the hollows mirror the studio, relative to the default */
  environmentIntensity?: number
  /** how much dirt has settled in the hollows, 0 to 1 */
  grime?: number
  /** paint over the gilding, like a monogram, where its mask is 1 */
  overlay?: (surface: FrameSurface) => {
    color: Node<'vec3'>
    mask: Float
  }
  relief?: GiltRelief
  /** how far the polished ridges and the matte flats scatter their reflections */
  roughness?: {
    burnished: number
    matte: number
  }
  /** how much of the ridges is rubbed through to the bole, 0 to 1 */
  wear?: number
}

type Float = Node<'float'>

/** water gilding’s deep yellow gold, a touch cooler than the shared gold of the fittings */
const waterGold = [0.9, 0.55, 0.2] as const

/**
 * Water gilding as old frames carry it: gold leaf on a red bole, burnished bright on the ridges and left matte on the flats, rubbed through to the bole where hands and dusters wore the crests, and darkened by dust and old size in the hollows.
 *
 * It reads the frame’s attributes, so it only suits frame geometry. A {@link GiltRelief} carves ornament into it as shading alone, its hollows taking the grime like the moulding’s own.
 */
export default class GiltMaterial extends MeshPhysicalNodeMaterial {
  constructor({bole = '#7a2f1b', environmentIntensity = 1, overlay, roughness = {
    burnished: 0.12,
    matte: 0.3,
  }, relief, grime = 0.5, wear = 0.25}: GiltOptions = {}) {
    super({
      metalness: 1,
      envMap: frameStudio,
      envMapIntensity: environmentIntensity,
    })
    const surface = readSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('giltFootprint')
    const carved = relief ? relief.height(surface).toVar('giltRelief') : float(0)
    // The carving’s own hollows count like the moulding’s, its crests like its ridges.
    const cavity = relief ? clamp(surface.cavity.add(float(0.5).sub(carved.div(relief.depth)).mul(1.4)), -1, 1) : surface.cavity
    const ridge = cavity.mul(-1).smoothstep(0.15, 0.7).toVar('giltRidge')
    const hollow = cavity.smoothstep(0.1, 0.8).toVar('giltHollow')
    const patches = mx_noise_float(p.mul(38).add(surface.piece.mul(7))).mul(0.5).add(0.5)
    const speckle = mx_noise_float(p.mul(310)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.004))
    // Rubbed through on the crests in ragged patches, and here and there in tiny losses everywhere.
    const handled = float(1).sub(surface.isOrnament.mul(0.6))
    const rubbed = ridge.mul(handled).mul(patches.add(speckle.mul(0.35)).smoothstep(float(1).sub(wear * 0.75), float(1.05).sub(wear * 0.55))).max(speckle.smoothstep(0.93, 0.97).mul(wear * 0.6)).toVar('giltRubbed')
    const toning = mx_noise_float(p.mul(4.3).add(surface.piece.mul(3))).mul(0.5).add(0.5)
    const gold = vec3(...waterGold).mul(toning.mul(0.08).add(0.94))
    const dirty = mix(gold, gold.mul(vec3(0.42, 0.34, 0.24)), hollow.mul(grime))
    const clay = color(bole).mul(patches.mul(0.25).add(0.85))
    const painted = overlay?.(surface)
    const paintMask = painted?.mask ?? float(0)
    this.colorNode = mix(mix(dirty, clay, rubbed), painted?.color ?? vec3(0), paintMask)
    this.metalnessNode = float(1).sub(rubbed.mul(0.92)).mul(float(1).sub(paintMask))
    const crackle = mx_worley_noise_float(p.mul(160)).smoothstep(0, 0.08).oneMinus().mul(visibleDetail(footprint, 0.006))
    this.roughnessNode = mix(mix(float(roughness.matte), float(roughness.burnished), ridge).add(hollow.mul(grime * 0.25)).add(rubbed.mul(0.35)).add(crackle.mul(0.08)), float(0.55), paintMask)
    const grain = speckle.mul(0.00002).sub(crackle.mul(0.00003))
    this.normalNode = heightNormal(carved.add(grain).add(smoothstep(0, 1, rubbed).mul(-0.00008)))
  }
}
