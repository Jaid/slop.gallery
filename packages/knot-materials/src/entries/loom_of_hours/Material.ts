import type {Texture} from 'three/webgpu'

import {color, float, mix, mx_noise_float, select, time, uv, vec2, vec3} from 'three/tsl'

import {uvFootprint} from '../../candidates/deepseek/lib/uvFootprint.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const warpThreads = 48
// A multiple of the weave period keeps the twill unbroken where the UV seam closes.
const weftThreads = 210
/** Crimson silk shot with gold, woven into a knot. Warp and weft are dyed differently, so the cloth changes its mind as you walk past it: one step shows the crimson ground, the next the gold figuring, and the sheen of every thread runs along its own length like a filament. A damask figure appears in the satin floats, thread by thread, while a slow breath in the fabric keeps the light travelling across it. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const {view, grazing, near, intimate} = viewerFrame()
    const t = time
    const footprint = uvFootprint()
    const warp = tube.y.mul(warpThreads)
    const weft = tube.x.mul(weftThreads)
    const warpLocal = warp.fract().sub(0.5)
    const weftLocal = weft.fract().sub(0.5)
    const warpIndex = warp.floor()
    const weftIndex = weft.floor()
// A damask figure decides where the weft floats over the ground for long stretches.
    const figure = tube.x.mul(Math.PI * 12).sin().mul(tube.y.mul(Math.PI * 6).sin()).add(tube.x.mul(Math.PI * 20).add(tube.y.mul(Math.PI * 10)).sin().mul(0.4))
    const satin = figure.smoothstep(0.25, 0.55)
    const twill = warpIndex.add(weftIndex.mul(2)).mod(5).lessThan(3)
    const warpOnTop = select(satin.greaterThan(0.5), float(1).lessThan(0.5), twill)
    const warpProfile = warpLocal.abs().mul(-2).add(1).max(0).sqrt()
    const weftProfile = weftLocal.abs().mul(-2).add(1).max(0).sqrt()
    const surfaceProfile = select(warpOnTop, warpProfile, weftProfile)
    const threadResolved = float(0.45).div(footprint.v.mul(warpThreads)).min(1)
// The cloth breathes once every two seconds; highlights travel along the threads with it.
    const breath = tube.x.mul(Math.PI * 4).sub(t.mul(Math.PI)).sin().mul(0.5).add(0.5)
    const crossThread = view.dot(vec3(0, 0, 1)).abs().mul(0)
    const weaveShadow = select(warpOnTop, weftLocal.abs(), warpLocal.abs()).smoothstep(0.3, 0.5).oneMinus()
    const crimson = mix(color('#3a030f'), color('#9c1229'), warpProfile.mul(0.45).add(0.3))
    const gold = mix(color('#5c3c0b'), color('#d8a63c'), weftProfile.mul(0.45).add(0.35))
    const thread = mix(crimson, gold, select(warpOnTop, float(0), float(1)))
    const twist = weft.add(warpLocal.mul(26)).add(t.mul(0.4)).sin().mul(0.5).add(0.5)
    const dust = mx_noise_float(vec3(tube.x.mul(220), tube.y.mul(46), 0)).mul(0.5).add(0.5)
    this.colorNode = thread.mul(weaveShadow.mul(0.5).add(0.55)).mul(twist.mul(0.12).add(0.94)).mul(dust.mul(0.12).add(0.94)).add(color('#ffd9a8').mul(satin).mul(surfaceProfile).mul(0.22))
    const relief = surfaceProfile.mul(0.9).add(satin.mul(surfaceProfile).mul(0.25)).sub(weaveShadow.mul(0.25)).add(twist.mul(near).mul(0.12)).add(breath.mul(0.12))
    this.normalNode = proceduralNormal(relief, float(0.0016).mul(threadResolved).mul(near.mul(0.35).add(0.65)))
    this.anisotropyNode = select(warpOnTop, vec2(0, 1), vec2(1, 0)).mul(twist.mul(0.3).add(0.7))
    this.anisotropy = 0.45
    this.metalnessNode = select(warpOnTop, float(0.02), float(0.25)).mul(satin.mul(0.5).add(0.5))
    this.roughnessNode = mix(float(0.34), float(0.2), satin).sub(surfaceProfile.mul(0.05)).add(dust.mul(0.04))
    this.specularColorNode = mix(color('#ffd0d8'), color('#ffe8b8'), breath)
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.3
    this.sheen = 0.45
    this.sheenRoughnessNode = mix(float(0.3), float(0.55), satin)
    this.aoNode = weaveShadow.mul(0.25).add(0.75)
    const glowThread = surfaceProfile.mul(twist.mul(0.4).add(0.6))
    const sheen = glowThread.mul(breath.mul(0.5).add(0.5)).mul(0.5).add(satin.mul(0.2))
    this.emissiveNode = mix(color('#ff3a5a'), color('#ffd070'), breath).mul(sheen).mul(0.3)
      .add(color('#ffe0b0').mul(twist.pow(3)).mul(surfaceProfile).mul(near).mul(0.2))
      .add(color('#ff8a6a').mul(grazing.pow(2.4)).mul(0.22))
      .add(color('#ffcf8a').mul(satin).mul(surfaceProfile).mul(intimate).mul(0.12))
      .add(color('#ffd8a0').mul(crossThread))
  }
}
