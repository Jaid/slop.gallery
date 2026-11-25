import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {fill, stroke} from '../../candidates/gpt_sol/lib/exhibition/coverage.ts'
import {closedDomain, filteredCos, resolved, softNoise} from '../../candidates/gpt_sol/lib/exhibition/fields.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

/** Animated maki-e koi, made from raised gold leaf, suspended in polished oxblood lacquer. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = data.id
    const tube = uv()
    const {p, near, intimate, grazing} = viewerFrame()
    const count = vec2(8, 2)
    const q = tube.mul(count).sub(vec2(time.mul(0.095), 0))
    const random = cellNoiseVec3(vec3(wrapCell(q.floor(), count), 171.2))
    const local = q.fract().sub(0.5)
    const phase = time.mul(1.25).add(random.z.mul(TAU))
    const angle = random.y.sub(0.5).mul(0.45).add(phase.sin().mul(0.05))
    // Correct the tube’s long/short UV metric so the koi have bodies, not needle-thin silhouettes.
    const metric = vec2(local.x, local.y.div(1.6))
    const point = vec2(metric.x.mul(angle.cos()).sub(metric.y.mul(angle.sin())), metric.x.mul(angle.sin()).add(metric.y.mul(angle.cos()))).toVar()
    const foot = q.fwidth().length().max(0.00001)
    const bodyPoint = point.sub(vec2(0.055, phase.sin().mul(0.01)))
    const bodyDistance = vec2(bodyPoint.x.div(0.255), bodyPoint.y.div(0.095)).length().sub(1)
    const body = fill(bodyDistance, foot.mul(10)).toVar()
    const tailX = point.x.negate().sub(0.14)
    const tailY = point.y.sub(tailX.mul(13).sub(phase).sin().mul(tailX).mul(0.22))
    const tailDistance = tailX.negate().max(tailX.sub(0.21)).max(tailY.abs().sub(tailX.mul(0.64)))
    const tail = fill(tailDistance, foot).toVar()
    const finPoint = point.sub(vec2(0.07, 0))
    const finDistance = finPoint.x.abs().sub(0.07).max(finPoint.y.abs().sub(0.075).sub(finPoint.x.negate().max(0).mul(0.75)))
    const fin = fill(finDistance, foot).mul(body.oneMinus()).mul(0.8).toVar()
    const fish = body.max(tail).max(fin).toVar()
    const rim = stroke(bodyDistance, 0.045, foot.mul(10)).mul(body)
    const eyePoint = point.sub(vec2(0.253, 0.026))
    const eye = fill(eyePoint.length().sub(0.014), foot).toVar()
    const pupilGlint = fill(eyePoint.sub(vec2(0.003, 0.004)).length().sub(0.004), foot)
    const gill = stroke(vec2(point.x.sub(0.207), point.y.mul(0.7)).length().sub(0.05), 0.004, foot).mul(body).toVar()
    const spine = stroke(point.y.sub(point.x.mul(12).sub(phase).sin().mul(0.009)), 0.003, foot).mul(body).toVar()
    const scalePhase = point.x.mul(255).add(point.y.mul(155).sin().mul(1.3))
    const scales = filteredCos(scalePhase).mul(0.5).add(0.5).mul(body).mul(resolved(foot.mul(255), 0.5, 3)).toVar()
    const finRays = filteredCos(tailY.div(tailX.max(0.045)).mul(39)).mul(0.5).add(0.5).mul(tail).mul(resolved(foot.mul(150), 0.5, 2.5)).toVar()
    const gildingDomain = p.mul(170)
    const gildingNoise = mx_noise_float(gildingDomain).mul(resolved(gildingDomain.fwidth().length(), 0.25, 1.3)).mul(0.5).add(0.5)
    const gold = mix(color(hsl.integer(64, 77, 47)), color(hsl.integer(93, 82, 89)), random.x.mul(0.25).add(gildingNoise.mul(0.25)).add(bodyPoint.y.mul(-2).add(0.3)).clamp()).toVar()
    const pearlPatch = softNoise(vec3(point.mul(10), random.z.mul(17))).smoothstep(0.12, 0.45).mul(body).toVar()
    const koi = mix(gold, color(hsl.integer(87, 60, 91)), pearlPatch.mul(0.75)).mul(scales.mul(0.12).add(finRays.mul(0.08)).add(rim.mul(-0.14)).add(0.86)).toVar()
    const domain = closedDomain(tube, 6, 2)
    const current = tube.x.mul(TAU * 13).add(tube.y.mul(TAU * 2)).add(softNoise(domain).mul(2.7)).sub(time.mul(0.085))
    const wake = filteredCos(current).mul(0.5).add(0.5).pow(7).toVar()
    const undertone = softNoise(p.mul(5)).mul(0.5).add(0.5)
    const lacquer = mix(color(hsl.integer(3, 78, 11)), color(hsl.integer(21, 89, 39)), undertone.mul(0.65).add(wake.mul(0.18))).toVar()
    const leafDust = beads(p.mul(190), 24.1)
    const flecks = leafDust.mask.mul(leafDust.random.z.smoothstep(0.91, 0.97)).toVar()
    let painted = mix(lacquer, koi, fish)
    painted = mix(painted, color(hsl.integer(34, 62, 12)), eye.max(gill.mul(0.58)).max(spine.mul(0.35)))
    painted = painted.add(color(hsl.integer(90, 100, 94)).mul(pupilGlint).mul(0.5)).add(gold.mul(flecks).mul(fish.oneMinus()).mul(0.6))
    this.colorNode = painted
    this.metalnessNode = fish.mul(pearlPatch.mul(-0.5).add(0.85)).add(flecks.mul(fish.oneMinus()).mul(0.75)).clamp()
    this.roughnessNode = mix(float(0.21), float(0.29).sub(scales.mul(0.055)), fish)
    this.normalNode = proceduralNormal(fish.mul(0.00125).add(scales.mul(0.00015)).add(finRays.mul(0.0001)).sub(gill.mul(0.00024)).add(wake.mul(0.00016)), 0.7)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.065
    this.ior = 1.51
    this.emissiveNode = lacquer.mul(wake).mul(grazing.pow(2)).mul(near.mul(0.05).add(0.025)).add(gold.mul(flecks).mul(intimate).mul(0.04))
  }
}
