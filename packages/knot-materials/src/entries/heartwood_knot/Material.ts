import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentGeometry, color, float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, normalLocal, tangentGeometry, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Rosewood, cut from the heart of a tree that spent its life leaning. Fibers inside the block do not run straight: they swirl, and wherever one of those swirls turns to face you the wood lights up in a band of silk – the cat's eye that slides across the surface as you walk. Fine grain streaks film over everything, and as you come close the open pores and tiny calcium flecks of a tropical hardwood come out of the polish. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, facing, near, intimate} = viewerFrame()
    const t = time
    const tube = uv()
    const silkDrift = tube.x.mul(Math.PI * 4).sub(t.mul(Math.PI)).sin().mul(0.5).add(0.5)
// The grain direction field swirls in three dimensions; its own singularities read as wood knots.
    const swirl = mx_fractal_noise_vec3(p.mul(2.2), 3, 2.05, 0.5)
    const drift = mx_fractal_noise_vec3(p.mul(7.5).add(vec3(11.3, 3.7, 7.9)), 2, 2, 0.5).mul(0.3)
    const fiber = swirl.add(drift).normalize()
    const chatoyance = fiber.dot(view).abs().pow(3).mul(near.mul(0.3).add(0.7))
// Growth rings run through the block at a shallow angle, warped by everything the tree lived through.
    const ringPhase = p.dot(vec3(0.32, 0.9, 0.24).normalize()).mul(96).add(mx_fractal_noise_float(p.mul(2.1), 3, 2, 0.5).mul(9))
    const rings = ringPhase.sin().mul(0.5).add(0.5)
    const endGrain = fiber.dot(normalLocal.normalize()).abs().pow(2)
    const fiberLines = mx_noise_float(p.mul(210).add(fiber.mul(3))).mul(0.5).add(0.5)
    const flecks = mx_noise_float(p.mul(340).add(vec3(0, t.mul(0.01), 0))).mul(0.5).add(0.5)
    const wood = mix(color(hsl.integer(43, 60, 7.5)), color(hsl.integer(45, 77, 25)), rings.mul(0.6).add(0.2))
    const silk = color(hsl.integer(66, 67, 71)).mul(chatoyance.pow(1.9)).mul(fiberLines.mul(0.3).add(0.8)).mul(silkDrift.mul(0.4).add(0.8))
    const dense = wood.mul(endGrain.mul(0.35).add(0.8)).mul(fiberLines.mul(0.25).add(0.85))
    this.colorNode = mix(dense.add(silk), color(hsl.integer(40, 43, 4.6)), mx_noise_float(p.mul(5)).mul(0.25).add(0.15).clamp())
    const pores = mx_noise_float(p.mul(320)).smoothstep(0.24, 0.36).mul(near)
    const relief = silk.length().mul(0.35).add(fiberLines.mul(0.4)).sub(pores.mul(0.8)).add(rings.mul(0.25))
    this.normalNode = proceduralNormal(relief, float(0.0016).mul(near.mul(0.5).add(0.5)))
    const grainTangent = vec2(fiber.dot(tangentGeometry).mul(0.55), fiber.dot(bitangentGeometry as unknown as Node<'vec3'>).mul(0.55))
    this.anisotropyNode = grainTangent.clamp(-1, 1)
    this.anisotropy = 0.5
    this.metalnessNode = float(0.05)
    this.roughnessNode = mix(float(0.3), float(0.14), chatoyance.mul(0.7)).add(pores.mul(0.12)).add(flecks.mul(0.05))
    this.specularColorNode = mix(color(hsl.integer(75, 100, 88.4)), color(hsl.integer(83, 100, 96.6)), chatoyance)
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.25
    this.aoNode = endGrain.mul(-0.15).add(0.9)
    const fleckGlint = flecks.smoothstep(0.72, 0.78).mul(near).mul(silkDrift.pow(3).mul(0.9).add(0.1))
    this.emissiveNode = silk.mul(0.4).mul(facing.mul(0.5).add(0.5))
      .add(color(hsl.integer(67, 100, 87)).mul(chatoyance.pow(3)).mul(0.5))
      .add(color(hsl.integer(68, 99, 81.4)).mul(fleckGlint).mul(0.6))
      .add(color(hsl.integer(48, 80, 34)).mul(facing.oneMinus().pow(2)).mul(0.1))
      .add(color(hsl.integer(56, 100, 74)).mul(chatoyance).mul(intimate).mul(0.12))
  }
}
