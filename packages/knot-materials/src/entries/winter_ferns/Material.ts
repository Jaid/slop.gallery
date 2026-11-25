import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionGeometry, time, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Sharp ridge of a smooth noise field: 1 on the zero crossing, falling off with width `w`. Filtered against the pixel footprint. */
const ridge = (field: Node<'float'>, w: number) => {
  const foot = field.fwidth().max(1e-4)
  return field.abs().smoothstep(w, foot.mul(1.2).add(w)).oneMinus().mul(foot.smoothstep(w * 3, w * 14).oneMinus())
}
/** Frost ferns on dark glass. Three generations of dendrites branch from one another at 60°, hoarfrost spikes fill the gaps, and every crystal face is a random facet that flashes when the light finds it. Frost is thickest at the silhouette and thins as you approach – the closer you look, the more of the black glass underneath shows through, wet and reflecting. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const {near, intimate, grazing, facing, objectDistance} = viewerFrame()
    const p = positionGeometry
    const rotate = (v: Node<'vec3'>, a: number) => vec3(v.x.mul(Math.cos(a)).sub(v.y.mul(Math.sin(a))), v.x.mul(Math.sin(a)).add(v.y.mul(Math.cos(a))), v.z)
    const seed = mx_noise_float(p.mul(2.1)).mul(0.5)
    const q = p.add(seed.mul(0.6))
  // Primary fronds stretch along one axis; secondaries rotate 60° and are squeezed, like real fern frost.
    const stretch = (v: Node<'vec3'>, k: number) => vec3(v.x.mul(k), v.y.mul(k * 0.45), v.z.mul(k * 1.3))
    const trunk = ridge(mx_noise_float(stretch(q, 6.5)), 0.055)
    const branch = ridge(mx_noise_float(stretch(rotate(q, Math.PI / 3).add(11.3), 16)), 0.06)
    const twig = ridge(mx_noise_float(stretch(rotate(q, -Math.PI / 3).add(5.7), 34)), 0.07).mul(near.mul(0.6).add(0.4))
    const fronds = trunk.max(branch.mul(0.85)).max(twig.mul(0.7))
    const cover = mx_noise_float(p.mul(3.1).add(vec3(3.7, 3.7, time.mul(0.02)))).mul(0.5).add(0.5)
  // Thicker frost at the silhouette; thinner toward the viewer when very close (a warm breath).
    const breath = objectDistance.smoothstep(0.7, 1.3).oneMinus().mul(facing.pow(1.4)).mul(0.75)
    const density = cover.mul(0.5).add(grazing.pow(1.3).mul(0.7)).add(0.15).sub(breath).clamp()
    const frostMask = fronds.mul(density.smoothstep(0.2, 0.7)).max(density.smoothstep(0.55, 1).mul(0.75)).clamp()
    const hoar = cellNoiseVec3(p.mul(140)).mul(0.5)
    const glass = mix(color(hsl.integer(258, 58, 4)), color(hsl.integer(259, 63, 10)), cover.mul(0.6))
    const ice = mix(color(hsl.integer(245, 63, 85)), color(hsl.integer(226, 100, 98)), frostMask.mul(facing.mul(0.5).add(0.5)))
    this.colorNode = mix(glass, ice, frostMask.mul(0.92))
    this.metalness = 0
    this.roughnessNode = mix(float(0.03), float(0.58), frostMask)
    this.clearcoatNode = frostMask.oneMinus().mul(0.9)
    this.clearcoatRoughness = 0.025
    this.ior = 1.31
    this.sheen = 0.5
    this.sheenColor.set(hsl.integer(246, 100, 90.7))
    this.sheenRoughness = 0.4
    this.iridescenceNode = frostMask.mul(0.25)
    this.iridescenceThicknessNode = cover.mul(220).add(180)
    const height = frostMask.mul(0.0028).add(fronds.mul(0.0012)).add(hoar.x.mul(frostMask).mul(near).mul(0.0009))
    const shaded = bumpNormal(normalViewGeometry.normalize(), height)
    this.normalNode = shaded
  // Crystal faces: every cell of the lattice flashes only for viewers standing in exactly the right place.
    const facet = shaded.add(vec3(hoar.x.sub(0.25), hoar.y.sub(0.25), hoar.z.sub(0.25)).mul(1.6)).normalize()
    const twinkle = time.mul(0.9).add(hoar.x.mul(40)).sin().mul(0.25).add(0.75)
    const flashes = glints(facet, 220).mul(frostMask).mul(near.mul(0.7).add(0.3)).mul(twinkle)
    const cold = mx_noise_float(p.mul(30).add(vec3(0, 0, time.mul(0.25)))).mul(0.5).add(0.5).mul(time.mul(0.5).add(fronds.mul(6)).sin().mul(0.3).add(0.7))
    this.emissiveNode = color(hsl.integer(238, 99, 94)).mul(flashes).mul(0.55)
      .add(color(hsl.integer(264, 100, 61)).mul(fronds.mul(grazing.pow(2))).mul(cold).mul(0.12))
      .add(color(hsl.integer(252, 99, 77)).mul(frostMask).mul(intimate).mul(0.02))
  }
}
