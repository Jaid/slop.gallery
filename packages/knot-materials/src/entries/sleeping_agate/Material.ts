import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, normalView, select, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Concentric silica shells per unit of object space. */
const bandsPerUnit = 46
/** Radial shell coordinate, stretched slightly along one axis and bent by slow noise so the rings never close into perfect circles. */
const silica = (q: Node<'vec3'>) => q.mul(vec3(1, 1.3, 1)).length().add(mx_fractal_noise_float(q.mul(2.3), 3, 2, 0.5).mul(0.16))
/** Four stops of agate, chosen per band by a random index in [0, 1). Linear light, with the stops looping seamlessly. */
const agateTone = (h: Node<'float'>) => {
  const ivory = color(hsl.integer(84, 44, 90.6))
  const honey = color(hsl.integer(71, 66, 69))
  const rust = color(hsl.integer(41, 71, 43))
  const smoke = color(hsl.integer(38, 13, 40))
  return select(h.lessThan(0.25), mix(ivory, honey, h.mul(4)), select(h.lessThan(0.5), mix(honey, rust, h.sub(0.25).mul(4)), select(h.lessThan(0.75), mix(rust, smoke, h.sub(0.5).mul(4)), mix(smoke, ivory, h.sub(0.75).mul(4)))))
}

/** Polished agate with concentric silica bands that never quite close. The bands are sampled a little below the surface, so they slide as you walk around the stone, as if you were seeing the stone's depth. Moss-like dendrites grow in patches, a drusy of quartz points sparkles near the surface, and the whole stone breathes on a two-second loop. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
    const breath = time.mul(Math.PI).add(p.y.mul(3.5)).sin().mul(0.012)
    const x = silica(p).add(breath).mul(bandsPerUnit)
    const f = x.fract()
    const edge = f.smoothstep(0, 0.14).mul(f.oneMinus().smoothstep(0, 0.14))
    const surfaceTone = agateTone(mx_cell_noise_float(x.floor())).mul(edge.mul(0.3).add(0.7))
// The band seen through the surface: a point deeper along the view ray, shading the stone's translucency.
    const deep = p.sub(view.mul(0.16))
    const deepX = silica(deep).add(breath).mul(bandsPerUnit)
    const deepTone = agateTone(mx_cell_noise_float(deepX.floor()))
// Dendrites: thin fern-like zero crossings of a fractal field, confined to patches.
    const fern = mx_fractal_noise_float(p.mul(9).add(silica(p).mul(2)), 4, 2.2, 0.5)
    const zone = mx_noise_float(p.mul(1.6)).smoothstep(0.1, 0.5)
    const dendrite = fern.abs().smoothstep(0, 0.035).oneMinus().mul(zone).mul(0.85)
    const moss = mix(color(hsl.integer(53, 40, 13)), color(hsl.integer(131, 46, 24)), mx_noise_float(p.mul(5)).mul(0.5).add(0.5))
// Drusy quartz: small points whose specular flashes only when they face the room.
    const druse = cellularPoints(p.mul(64), 0.05, 0.2, 0.78)
    const sparkle = glints(normalView, 46).mul(druse)
    this.colorNode = mix(surfaceTone, moss, dendrite)
    this.metalness = 0
    this.roughnessNode = float(0.26).add(dendrite.mul(0.2))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    const normal = proceduralNormal(edge.oneMinus().mul(0.0009).sub(dendrite.mul(0.0006)), 1)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
// Light seeps out of the deeper layers and warms toward the grazing edge.
    this.emissiveNode = deepTone.mul(grazing.mul(0.22).add(0.14))
      .add(color(hsl.integer(83, 100, 95.3)).mul(sparkle).mul(near.mul(0.9).add(0.1)).mul(1.5))
  }
}
