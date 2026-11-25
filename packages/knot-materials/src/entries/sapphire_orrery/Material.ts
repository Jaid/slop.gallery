import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {enamel, etch, ornamentCell, polarTicks, turn} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Armillary instruments engraved in lacquer, with independently moving optical strata below them. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.78)
    this.name = data.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const ray = tubeRay()
    const {q, random} = ornamentCell(tube, 18, 2, 7)
    const r = q.length()
    const rim = etch(r.sub(0.418), 0.009)
    const insideRim = etch(r.sub(0.386), 0.003)
    const face = enamel(r.sub(0.37))
    const ticks = polarTicks(q, 72, 0.07)
      .mul(enamel(r.sub(0.41))).mul(enamel(float(0.388).sub(r)))
    const cardinal = polarTicks(q, 12, 0.05)
      .mul(enamel(r.sub(0.409))).mul(enamel(float(0.367).sub(r)))
    const lozenge = etch(q.x.abs().add(q.y.abs()).sub(0.49), 0.003)
      .mul(enamel(float(0.425).sub(r)))
    const brass = rim.add(insideRim).add(ticks.mul(0.7)).add(cardinal).add(lozenge.mul(0.7)).clamp()
    const silk = mx_noise_float(p.mul(95)).mul(0.5).add(0.5)
    const navy = mix(color(hsl.integer(261, 76, 7)), color(hsl.integer(243, 69, 23)), mx_noise_float(p.mul(4)).mul(0.23).add(0.38))
    const metal = mix(color(hsl.integer(65, 73, 44)), color(hsl.integer(82, 68, 80)), random.y.mul(0.4).add(silk.mul(0.2)).add(0.3))
    let sky: Node<'vec3'> = vec3(0)
    // This is bounded tangent-space parallax, not camera-projected noise. The instrument stays on the object.
    for (const [i, depth] of [0.017, 0.049, 0.087].entries()) {
      const layer = ornamentCell(tube.sub(ray.mul(depth)), 18, 2, 7)
      const spin = layer.random.z.mul(TAU).add(time.mul((i % 2 ? -1 : 1) * (0.045 + i * 0.019)))
      const local = turn(layer.q, spin)
      const radius = 0.13 + i * 0.068
      const ellipse = vec2(local.x, local.y.mul(1.18 + i * 0.2)).length()
      const orbit = etch(ellipse.sub(radius), 0.0025)
      const second = etch(local.length().sub(radius + 0.025), 0.0011).mul(0.3)
      const planetAngle = time.mul(0.22 - i * 0.037).add(layer.random.x.mul(TAU)).add(i * 2.5)
      const planetPosition = vec2(planetAngle.cos().mul(radius), planetAngle.sin().mul(radius / (1.18 + i * 0.2)))
      const planetDistance = local.sub(planetPosition).length()
      const planet = enamel(planetDistance.sub(0.014 - i * 0.002))
      const halo = planetDistance.mul(-70).exp().mul(0.2)
      const meridian = etch(local.x.mul(0.75).add(local.y.mul(0.4)), 0.0012)
        .mul(enamel(local.length().sub(0.28))).mul(0.3)
      const tint = mix(color(hsl.integer(213, 63, 65)), color(hsl.integer(86, 56, 85)), float(i / 2))
      const breathing = time.mul(0.35).add(layer.random.x.mul(TAU)).sin().mul(0.08).add(0.92)
      sky = sky.add(tint.mul(orbit.mul(0.38).add(second).add(meridian).add(planet.mul(2.1)).add(halo))
        .mul(Math.exp(-depth * 4)).mul(breathing))
    }
    // A fourth, sparse star layer only resolves when the viewer leans in.
    const stars = ornamentCell(tube.sub(ray.mul(0.11)), 108, 12, 33)
    const starDistance = stars.q.sub(stars.random.xy.sub(0.5).mul(0.45)).length()
    const star = enamel(starDistance.sub(0.037)).mul(stars.random.z.smoothstep(0.68, 0.75))
      .mul(stars.grid.fwidth().length().smoothstep(0.2, 0.85).oneMinus())
    const starCross = etch(stars.q.x, 0.012).mul(etch(stars.q.y, 0.12))
      .mul(stars.random.z.smoothstep(0.94, 0.99)).mul(intimate)
    const cartography = etch(q.y.add(q.x.mul(2.7).sin().mul(0.11)), 0.001)
      .mul(face).mul(intimate).mul(0.14)
    this.colorNode = mix(navy.mul(silk.mul(0.05).add(0.95)), metal, brass)
    this.metalnessNode = mix(float(0.12), float(0.94), brass)
    this.roughnessNode = mix(float(0.18), float(0.29), brass).add(silk.mul(0.015))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.055
    this.ior = 1.53
    this.normalNode = proceduralNormal(brass.mul(0.00055).add(silk.mul(0.00006)), 0.8)
    this.anisotropy = 0.35
    this.anisotropyNode = vec2(0, 1).mul(brass).mul(0.35)
    this.emissiveNode = sky.mul(face).mul(facing.mul(0.4).add(0.6)).mul(near.mul(0.22).add(0.68))
      .add(color(hsl.integer(216, 33, 85)).mul(star.add(starCross)).mul(face).mul(0.68))
      .add(color(hsl.integer(233, 57, 62)).mul(cartography))
      .add(color(hsl.integer(252, 72, 35)).mul(grazing.pow(3)).mul(0.035))
  }
}
