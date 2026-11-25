import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {coverage, periodicSurface, resolved, surfaceTile} from '../../candidates/gpt_sol/lib/gallerySurface.ts'
import {inkFill} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Articulated fish silhouettes with forked tails, fin rays, staggered scales and tiny lacquer eyes. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = data.id
    const tube = uv()
    const {grazing, intimate, near} = viewerFrame()
    const swim = tube.sub(vec2(time.mul(0.0035), time.mul(0.0007)))
    const tile = surfaceTile(swim, 12, 2)
    const seed = cellNoiseVec3(vec3(tile.cell, 211)).toVar()
    const angle = seed.x.sub(0.5).mul(0.85)
    const v = tile.local.mul(vec2(1.48, 1))
    const x = v.x.mul(angle.cos()).sub(v.y.mul(angle.sin()))
    const y = v.x.mul(angle.sin()).add(v.y.mul(angle.cos()))
    const tailMotion = time.mul(1.7).add(seed.z.mul(TAU)).add(x.mul(11)).sin().mul(0.025)
      .mul(x.smoothstep(-0.3, 0.05).oneMinus())
    const q = vec2(x, y.sub(tailMotion)).toVar()
    const aa = tile.footprint.mul(1.5)
    const bodyField = vec2(q.x.sub(0.015).div(0.285), q.y.div(q.x.smoothstep(-0.28, 0.04).mul(0.085).add(0.047))).length().sub(1)
    const body = inkFill(bodyField, aa.mul(8)).toVar()
    const tailSpan = q.x.negate().sub(0.23).mul(0.65).clamp(0, 0.16)
    const tailField = q.y.abs().sub(tailSpan).max(q.x.add(0.24)).max(q.x.negate().sub(0.48))
    const tailNotch = inkFill(q.sub(vec2(-0.495, 0)).length().sub(0.067), aa)
    const tail = inkFill(tailField, aa).mul(tailNotch.oneMinus()).toVar()
    const finQ = vec2(q.x.add(0.05), q.y.abs().sub(0.15))
    const finField = vec2(finQ.x.add(finQ.y.mul(0.7)).div(0.13), finQ.y.div(0.044)).length().sub(1)
    const fins = inkFill(finField, aa.mul(17)).toVar()
    const fish = body.max(tail).max(fins).toVar()
    const scalesQ = vec2(q.x.mul(31).add(q.y.mul(36).floor().mod(2).mul(0.5)), q.y.mul(36))
    const scaleLocal = scalesQ.fract().sub(0.5)
    const arc = scaleLocal.add(vec2(0, -0.38)).length().sub(0.61)
    const scales = coverage(arc, 0.038, scalesQ.fwidth().length()).mul(body).mul(intimate)
      .mul(scalesQ.fwidth().length().smoothstep(0.6, 1.8).oneMinus()).toVar()
    const patchNoise = mx_noise_float(vec3(q.mul(vec2(12, 20)), seed.y.mul(25)))
    const red = patchNoise.smoothstep(-0.05, 0.16).mul(body).mul(q.y.abs().smoothstep(0.055, 0.13).oneMinus()).toVar()
    const gold = mix(color(hsl.integer(69, 79, 56)), color(hsl.integer(89, 76, 87)), q.y.abs().div(0.15).clamp().oneMinus())
    const koi = mix(gold, color(hsl.integer(32, 96, 44)), red).mul(scales.mul(0.42).oneMinus())
    const rays = q.x.mul(110).add(q.y.mul(46)).sin()
    const finRays = coverage(rays, 0.09, rays.fwidth()).mul(resolved(rays)).mul(fins.max(tail)).mul(intimate)
    const eye = inkFill(q.sub(vec2(0.205, 0.039)).length().sub(0.014), aa)
    const pupil = inkFill(q.sub(vec2(0.208, 0.04)).length().sub(0.007), aa)
    const decorated = mix(mix(koi, color(hsl.integer(91, 100, 95)), eye), color(hsl.integer(179, 14, 6)), pupil)
    const currentsNoise = mx_noise_float(periodicSurface(tube, 16, 3).add(vec3(0, 0, time.mul(0.025)))).toVar()
    const currentPhase = tube.y.mul(TAU * 12).add(tube.x.mul(TAU * 8)).add(currentsNoise.mul(1.4)).sub(time.mul(0.11))
    const currents = coverage(currentPhase.sin(), 0.035, currentPhase.fwidth()).mul(resolved(currentPhase)).mul(fish.oneMinus())
    const lacquer = mix(color(hsl.integer(195, 64, 6)), color(hsl.integer(180, 79, 17)), currentsNoise.mul(0.5).add(0.5))
    this.colorNode = mix(lacquer.add(color(hsl.integer(90, 58, 64)).mul(currents).mul(0.17)), decorated, fish)
      .mul(finRays.mul(0.25).oneMinus())
    this.metalnessNode = fish.mul(0.86).mul(red.mul(0.75).oneMinus()).mul(pupil.oneMinus())
    this.roughnessNode = mix(float(0.17), float(0.285), fish).add(scales.mul(0.055))
    this.anisotropyNode = vec2(angle.cos(), angle.sin()).mul(fish.mul(0.48))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.ior = 1.5
    this.normalNode = proceduralNormal(fish.mul(0.0009).sub(scales.mul(0.00025)).sub(finRays.mul(0.00018)), 0.7)
    this.clearcoatNormalNode = proceduralNormal(currentsNoise.mul(0.0003), 0.6)
    this.emissiveNode = color(hsl.integer(83, 65, 66)).mul(currents).mul(near).mul(0.025)
    this.iridescenceNode = grazing.pow(3).mul(fish.oneMinus()).mul(0.18)
    this.iridescenceThicknessNode = float(280)
  }
}
