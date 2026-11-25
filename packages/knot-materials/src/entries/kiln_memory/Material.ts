import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, uv, vec2, vec3} from 'three/tsl'

import {buriedUv} from '../../candidates/gpt_sol/lib/exhibition/buriedOptics.ts'
import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {fill, resolved, segment, stroke, tiles, turn} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Hand-painted oxide under a clear, crazed glaze; ink washes have their own optical depth. */
function garden(tube: Node<'vec2'>) {
  const {local: q, random} = tiles(tube, [18, 2], 23)
  const stalk = q.x.sub(q.y.mul(6.2).sin().mul(0.045))
  let ink = stroke(stalk, 0.013).mul(fill(q.y.abs().sub(0.405)))
  let leafHeight: Node<'float'> = float(0)
  for (let i = 0;i < 6;i++) {
    const side = i % 2 === 0 ? 1 : -1
    const y = -0.29 + i * 0.11
    const origin = vec2(Math.sin(y * 6.2) * 0.045, y)
    const tip = origin.add(vec2(side * 0.2, 0.085))
    const branch = stroke(segment(q, origin, tip), 0.009)
    const leaf = turn(q.sub(tip), side * 0.72)
    const distance = leaf.x.abs().div(0.071).add(leaf.y.pow2().div(0.135 ** 2)).sub(1)
    const body = fill(distance)
    const veins = stroke(leaf.x, 0.005).mul(body)
    ink = ink.max(branch.mul(0.7)).max(body.mul(veins.mul(0.08).add(0.94)))
    leafHeight = leafHeight.max(body.mul(0.4))
  }
  const bud = q.sub(vec2(-0.025, 0.34))
  const angle = bud.y.atan(bud.x)
  const radius = bud.length()
  const petals = fill(radius.sub(angle.mul(5).cos().mul(0.016).add(0.048)))
  ink = ink.max(petals.mul(0.9))
  return {
    ink,
    leafHeight,
    random,
    q,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    const painting = garden(buriedUv(tube, view, 0.0035, 1.51))
    const washDrift = vec3(exhibitionPhase.sin(), exhibitionPhase.cos(), 0).mul(0.32)
    const wash = mx_fractal_noise_float(p.mul(31).add(washDrift), 3, 2.2, 0.53).mul(0.5).add(0.5)
    const pigment = painting.ink.mul(wash.mul(0.22).add(0.78)).mul(intimate.mul(0.08).add(0.92))
    const fired = mx_noise_float(p.mul(5.2)).mul(0.5).add(0.5)
    const ivory = mix(color(hsl.integer(143, 17, 84)), color(hsl.integer(87, 100, 96)), fired.mul(0.6).add(0.4))
    const cobalt = mix(color(hsl.integer(261, 89, 17)), color(hsl.integer(252, 79, 40)), wash)
    const colors = mix(ivory, cobalt, pigment)
// Continuous 3D glaze fractures, so neither UV wrap creates a crackle seam.
    const crackQ = p.mul(35).add(mx_noise_float(p.mul(6)).mul(0.4))
    const cells = mx_worley_noise_vec3(crackQ, 0.9, 0)
    const cracks = stroke(cells.y.sub(cells.x), 0.008).mul(0.55)
    const stain = cracks.mul(wash.mul(0.42).add(0.25))
    const pinQ = p.mul(260)
    const pinholes = mx_noise_float(pinQ).smoothstep(0.6, 0.8).mul(resolved(pinQ)).mul(intimate)
// Rare iron-red maker's seals – a square border and a deliberately angular monogram.
    const sealQ = painting.q.sub(vec2(0.3, -0.29))
    const box = sealQ.x.abs().max(sealQ.y.abs()).sub(0.055)
    const border = stroke(box, 0.006)
    const monogram = stroke(segment(sealQ, vec2(-0.023, 0.028), vec2(0.023, -0.03)), 0.006)
      .max(stroke(segment(sealQ, vec2(-0.025, -0.03), vec2(-0.025, 0.026)), 0.006))
      .max(stroke(segment(sealQ, vec2(-0.025, 0), vec2(0.026, 0)), 0.006))
    const seal = border.max(monogram).mul(painting.random.x.smoothstep(0.74, 0.77))
    this.colorNode = mix(mix(colors, color(hsl.integer(127, 9, 53)), stain), color(hsl.integer(30, 81, 40)), seal)
    this.metalness = 0
    this.roughnessNode = float(0.21).add(cracks.mul(0.18)).add(pinholes.mul(0.3))
    this.ior = 1.51
    this.clearcoat = 0.92
    this.clearcoatRoughness = 0.065
    this.specularIntensity = 0.72
    const wheel = tube.y.mul(Math.PI * 2 * 9).sin().mul(0.000055)
    this.normalNode = proceduralNormal(wheel.add(painting.leafHeight.mul(0.0002)).sub(cracks.mul(0.00042)).sub(pinholes.mul(0.0001)), 1)
    this.clearcoatNormalNode = proceduralNormal(wheel.add(mx_noise_float(p.mul(28)).mul(0.0001)), 1)
    const awakening = exhibitionPhase.add(p.y.mul(5)).sin().mul(0.15).add(0.85)
    this.emissiveNode = color(hsl.integer(259, 74, 29)).mul(pigment).mul(grazing.pow(2)).mul(awakening).mul(near).mul(0.07)
  }
}
