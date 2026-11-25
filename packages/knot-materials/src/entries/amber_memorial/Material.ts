import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {coverage, periodicSurface, surfaceTile} from '../../candidates/gpt_sol/lib/gallerySurface.ts'
import {inkFill, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Layered absorption inside an opaque optical shell avoids scene-buffer and transparency sorting dependencies. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.68)
    this.name = data.id
    const tube = uv()
    const {grazing, intimate, near} = viewerFrame()
    const ray = tubeRay().toVar()
    let fossil: Node<'float'> = float(0)
    let dust: Node<'float'> = float(0)
    let amber: Node<'vec3'> = color(hsl.integer(50, 95, 50)).mul(0.3)
    // Back-to-front layers. Each frond has independently seeded placement and a bounded silhouette.
    for (let i = 6;i >= 0;i--) {
      const depth = 0.012 + i * 0.023
      const layerUV = tube.sub(ray.mul(depth)).add(vec2(i * 0.173, i * 0.117))
      const tile = surfaceTile(layerUV, 16, 2)
      const seed = cellNoiseVec3(vec3(tile.cell, i + 23)).toVar()
      const bend = tile.local.y.mul(5).sin().mul(0.085)
      const q = vec2(tile.local.x.sub(bend).sub(seed.x.sub(0.5).mul(0.12)), tile.local.y).toVar()
      const stalk = coverage(q.x, 0.007, tile.footprint).mul(q.y.abs().smoothstep(0.35, 0.42).oneMinus())
      const pair = q.y.mul(13).add(0.5).fract().sub(0.5)
      const span = q.y.add(0.44).div(0.88).clamp().oneMinus().mul(0.19).add(0.018)
      const rib = pair.sub(q.x.abs().mul(2.4))
      const leaf = coverage(rib, 0.075, tile.footprint.mul(13)).mul(q.x.abs().smoothstep(span, span.add(0.027)).oneMinus())
        .mul(q.y.abs().smoothstep(0.33, 0.42).oneMinus())
      const frond = stalk.max(leaf).mul(seed.z.smoothstep(0.47, 0.66)).mul(0.55 + (6 - i) * 0.035).toVar()
      const warmth = mix(color(hsl.integer(52, 91, 23)), color(hsl.integer(85, 100, 87)), seed.y)
      amber = mix(amber, warmth.mul(0.45), frond).add(color(hsl.integer(62, 97, 67)).mul(0.026)).toVar()
      fossil = fossil.add(frond.mul(1 - i * 0.075)).clamp().toVar()
      const grains = surfaceTile(layerUV.add(vec2(time.mul(0.0007), time.mul(-0.0012))), 144, 18)
      const particleSeed = cellNoiseVec3(vec3(grains.cell, 71 + i)).toVar()
      const particle = inkFill(grains.local.sub(particleSeed.xy.sub(0.5).mul(0.45)).length().sub(0.06), grains.footprint)
        .mul(particleSeed.z.smoothstep(0.91, 0.97))
      dust = dust.add(particle.mul(1 - i * 0.09)).toVar()
    }
    const resin = mx_noise_float(periodicSurface(tube, 11, 2)).mul(0.5).add(0.5).toVar()
    const flow = mx_noise_float(periodicSurface(tube, 41, 6).add(resin.mul(2))).toVar()
    const clear = mix(color(hsl.integer(41, 96, 35)), color(hsl.integer(71, 85, 72)), resin.mul(0.6).add(0.15))
    this.colorNode = mix(clear, color(hsl.integer(41, 74, 14)), fossil.mul(0.88)).mul(grazing.mul(0.3).oneMinus())
    this.emissiveNode = amber.mul(fossil.mul(0.68).oneMinus()).mul(near.mul(0.15).add(0.72))
      .add(color(hsl.integer(87, 100, 91.4)).mul(dust).mul(intimate.mul(0.6).add(0.28)))
    this.metalness = 0
    this.roughnessNode = float(0.17).add(flow.abs().mul(0.035))
    this.ior = 1.54
    this.specularIntensity = 0.9
    this.clearcoat = 1
    this.clearcoatRoughness = 0.055
    this.normalNode = proceduralNormal(flow.mul(0.0008).add(resin.mul(0.0011)), 0.6)
    this.iridescenceNode = grazing.pow(4).mul(0.1)
    this.iridescenceThicknessNode = float(370)
  }
}
