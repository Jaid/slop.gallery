import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {coverage, fern, ring, rotatePoint} from '../../candidates/gpt_astra/lib/exhibition/fields.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Three independently occluded botanical inclusions, trapped at different optical depths. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, facing, grazing, intimate, view} = viewerFrame()
    const tube = uv()
    const ray = tubeRay()
    const resin = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const transmissionLight = facing.pow(0.6).mul(0.62).add(resin.mul(0.22))
    let body: Node<'vec3'> = mix(color(hsl.integer(28, 67, 8)), color(hsl.integer(68, 95, 59)), transmissionLight)
    let fossil: Node<'float'> = float(0)
    // Back-to-front compositing gives leaves proper ordering rather than additive ghosts.
    for (let i = 2; i >= 0; i--) {
      const modules = vec2(8, 2)
      const q = tube.sub(ray.mul(0.025 + i * 0.03)).mul(modules).add(vec2(i * 0.37, i * 0.29))
      const aa = q.fwidth().length().max(0.0001)
      const cell = q.floor().mod(modules).add(modules).mod(modules)
      const seed = mx_cell_noise_vec3(vec3(cell, 13 + i * 7))
      const local = rotatePoint(q.fract().sub(0.5).mul(vec2(1.35, 1)), seed.x.sub(0.5).mul(1.7))
      const specimen = fern(local.mul(seed.z.mul(0.7).add(0.85)), aa).mul(seed.y.smoothstep(0.45, 0.56))
      const tint = mix(color(hsl.integer(108, 27, 4)), color(hsl.integer(59, 60, 9)), seed.z)
      const mineralFilm = mix(tint, color(hsl.integer(61, 51, 23)), float(i * 0.12))
      body = mix(body, mineralFilm, specimen.mul(0.98 - i * 0.09))
      fossil = fossil.max(specimen.mul(1 - i * 0.2))
    }
    // Spherical air inclusions have a dark lip and a bright crescent rather than flat dots.
    const bq = tube.sub(ray.mul(0.012)).mul(vec2(68, 9))
    const baa = bq.fwidth().length().max(0.0001)
    const bid = bq.floor().mod(vec2(68, 9)).add(vec2(68, 9)).mod(vec2(68, 9))
    const seed = mx_cell_noise_vec3(vec3(bid, 21))
    const bc = bq.fract().sub(seed.xy.mul(0.46).add(0.27))
    const br = bc.length()
    const bubbleGate = seed.z.smoothstep(0.72, 0.8)
    const bubble = coverage(br.sub(0.075), baa).mul(bubbleGate)
    const bubbleRim = ring(br, 0.076, 0.008, baa).mul(bubbleGate)
    const crescent = coverage(bc.sub(vec2(-0.023, 0.022)).length().sub(0.03), baa).mul(bubbleGate)
    body = mix(body, color(hsl.integer(53, 81, 26)), bubble.mul(0.42))
    body = mix(body, color(hsl.integer(83, 100, 85.4)), bubbleRim.mul(0.65).add(crescent.mul(0.75)).clamp())
    // Depth-integrated resin clouds are independent of the surface UVs and shift with the eye.
    let sediment: Node<'float'> = float(0)
    let cloud: Node<'float'> = float(0)
    const chord = facing.mul(0.21).add(0.015)
    for (let i = 0; i < 6; i++) {
      const sample = p.sub(view.mul(chord.mul((i + 0.5) / 6)))
      const swirl = mx_noise_float(sample.mul(vec3(9, 18, 7)))
      const wisp = mx_noise_float(sample.mul(43).add(swirl.mul(3)))
      cloud = cloud.add(wisp.add(swirl).smoothstep(0.15, 0.7).mul(1 / 6))
      const fq = sample.mul(105)
      const flakes = mx_cell_noise_vec3(fq)
      const faa = fq.fwidth().length().max(0.001)
      const center = flakes.mul(0.5).add(0.25)
      const particle = coverage(fq.fract().sub(center).length().sub(0.08), faa)
        .mul(faa.smoothstep(0.1, 0.65).oneMinus()).mul(flakes.z.smoothstep(0.8, 0.95))
      sediment = sediment.add(particle.mul(0.3))
    }
    const absorption = vec3(2, 6, 13).mul(chord).negate().exp()
    body = body.mul(absorption.mul(0.55).add(0.45))
    body = mix(body, color(hsl.integer(45, 88, 45)), cloud.mul(0.2))
    body = body.add(color(hsl.integer(88, 100, 91.5)).mul(sediment).mul(intimate))
    this.colorNode = body.mul(0.16)
    this.metalness = 0
    this.roughness = 0.08
    this.clearcoat = 0.75
    this.clearcoatRoughness = 0.045
    this.ior = 1.54
    const lantern = view.dot(vec3(-0.45, 0.6, 0.66)).mul(0.3).add(0.65)
    const breath = time.mul(0.3).sin().mul(0.035).add(0.965)
    this.emissiveNode = body.mul(lantern).mul(breath).mul(facing.mul(0.85).add(0.46))
      .add(color(hsl.integer(71, 100, 77)).mul(grazing.pow(3)).mul(0.18))
      .add(color(hsl.integer(85, 100, 90.4)).mul(crescent).mul(intimate).mul(0.12))
    this.aoNode = fossil.mul(-0.15).add(1)
  }
}
