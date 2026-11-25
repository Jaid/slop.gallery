import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv, vec2} from 'three/tsl'

import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {fill, resolved, stroke, tiles, wave} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Cut-pile velvet and raised couched gold, not a metallic surface painted purple. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    const {local: q, random} = tiles(tube, [32, 4], 11)
    const spine = q.x.sub(q.y.mul(6).sin().mul(0.065))
    const plume = vec2(spine.div(0.27), q.y.div(0.43)).length()
    const silhouette = fill(plume.sub(1))
    const border = stroke(plume.sub(0.94), 0.026).max(stroke(plume.sub(0.78), 0.018))
    const eye = vec2(spine.sub(0.025).div(0.13), q.y.sub(0.12).div(0.18)).length()
    const eyeThread = stroke(eye.sub(1), 0.026).max(stroke(eye.sub(0.61), 0.022))
    const rachis = stroke(spine, 0.012).mul(silhouette)
    const barbs = stroke(q.y.mul(32).add(spine.abs().mul(48)).sin(), 0.11)
      .mul(fill(plume.sub(0.72))).mul(eye.smoothstep(0.85, 1.2)).mul(0.82)
    const thread = border.max(eyeThread.mul(silhouette)).max(rachis).max(barbs).clamp()
// Individual stitches are fixed to the cloth. They converge to a smooth thread on retreat.
    const stitchPhase = q.y.add(spine.abs().mul(1.5)).mul(260)
    const stitch = wave(stitchPhase).mul(0.45).add(0.55)
    const napDirection = tube.x.mul(TAU * 3).sin().mul(0.5).add(exhibitionPhase.sin().mul(0.09))
    const napAngle = view.x.mul(napDirection.cos()).add(view.z.mul(napDirection.sin())).abs()
    const velvetLift = grazing.pow(1.7).mul(napAngle.mul(0.4).add(0.6))
    const ground = mix(color(hsl.integer(351, 61, 6)), color(hsl.integer(3, 78, 21)), velvetLift)
    const brocade = mix(color(hsl.integer(61, 75, 40)), color(hsl.integer(81, 72, 78)), stitch.mul(0.7).add(random.z.mul(0.3)))
    this.colorNode = mix(ground, brocade, thread)
    this.metalnessNode = thread.mul(0.87)
    this.roughnessNode = mix(float(0.94), float(0.28), thread).sub(stitch.mul(thread).mul(0.045))
    this.sheenNode = mix(color(hsl.integer(0, 67, 43)).mul(0.55), color(hsl.integer(81, 100, 90.7)).mul(0.08), thread)
    this.sheenRoughnessNode = mix(float(0.8), float(0.38), thread)
    this.anisotropyNode = vec2(napDirection.cos(), napDirection.sin()).mul(thread.mul(0.73))
    this.specularIntensityNode = mix(float(0.32), float(1), thread)
    this.clearcoatNode = thread.mul(0.08)
    this.clearcoatRoughness = 0.3
    const pileQ = p.mul(330)
    const pile = mx_noise_float(pileQ).mul(resolved(pileQ)).mul(intimate)
    const warp = wave(tube.x.mul(TAU * 1280)).mul(wave(tube.y.mul(TAU * 180)))
    const height = thread.mul(stitch.mul(0.00075).add(0.0006)).add(pile.mul(0.00009)).add(warp.mul(0.00006))
    this.normalNode = proceduralNormal(height, 1)
    this.aoNode = thread.mul(0.12).oneMinus()
// A quiet warm return in the finest couched thread; the pile itself never emits light.
    const breath = exhibitionPhase.add(tube.x.mul(TAU * 2)).sin().mul(0.15).add(0.85)
    this.emissiveNode = color(hsl.integer(78, 72, 79)).mul(thread).mul(stitch).mul(velvetLift).mul(near).mul(breath).mul(0.065)
  }
}
