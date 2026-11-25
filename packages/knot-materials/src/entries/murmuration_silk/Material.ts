import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.08)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const {grazing, near, intimate} = viewerFrame()
    // Each UV cell contains a small bird with its own phase. Rotation is biased by the viewer, which
    // turns a static repeat into a flock that appears to wheel around the knot as one walks past.
    const q = tube.mul(vec2(15, 7))
    const cell = q.floor()
    const identity = cellNoiseVec3(vec3(cell, 17.35))
    const local = q.fract().sub(0.5).sub(vec2(identity.x.sub(0.5), identity.y.sub(0.5)).mul(0.09))
    const angle = identity.x.mul(TAU).add(time.mul(0.11)).add(grazing.mul(1.8)).add(identity.y.mul(time.mul(0.24)))
    const c = angle.cos()
    const s = angle.sin()
    const rotated = vec2(local.x.mul(c).sub(local.y.mul(s)), local.x.mul(s).add(local.y.mul(c)))
    const wingbeat = time.mul(identity.z.mul(1.8).add(2.2)).add(identity.x.mul(TAU)).sin().mul(0.5).add(0.5)
    const wingLift = wingbeat.sub(0.5).mul(0.065)
    const leftWing = vec2(rotated.x.add(0.125), rotated.y.mul(1.5).sub(wingLift)).length().smoothstep(0.07, 0.2).oneMinus()
    const rightWing = vec2(rotated.x.sub(0.125), rotated.y.mul(1.5).add(wingLift)).length().smoothstep(0.07, 0.2).oneMinus()
    const body = vec2(rotated.x.mul(1.45), rotated.y.mul(1.9)).length().smoothstep(0.03, 0.078).oneMinus()
    const tail = rotated.x.abs().add(rotated.y.mul(2.3)).smoothstep(0.18, 0.31).oneMinus().mul(rotated.x.abs().smoothstep(0.04, 0.1))
    const bird = leftWing.max(rightWing).max(body.mul(1.15)).max(tail.mul(0.42)).clamp()
    const resolved = q.fwidth().length().smoothstep(0.08, 0.3).oneMinus()
    const flock = bird.mul(resolved).mul(near.mul(0.82).add(0.18))
    const warp = mx_noise_float(p.mul(2.4).add(vec3(time.mul(0.012), 0, time.mul(-0.009))))
    const warpWeave = opticalBands(tube.x.mul(TAU * 47).add(tube.y.mul(TAU * 8)).add(warp.mul(7)))
    const crossWeave = opticalBands(tube.y.mul(TAU * 74).sub(tube.x.mul(TAU * 5)).sub(warp.mul(4)))
    const nap = tangentView.normalize().dot(positionViewDirection).abs().clamp()
    const satin = nap.pow(1.35).mul(grazing.pow(0.8).mul(0.75).add(0.25))
    const backdrop = mix(color(hsl.integer(251, 60, 5)), color(hsl.integer(235, 68, 15)), warpWeave.mul(0.14).add(crossWeave.mul(0.12).add(0.5)))
    const dusk = mix(color(hsl.integer(277, 48, 4.5)), color(hsl.integer(316, 67, 11)), grazing.mul(0.34).add(warpWeave.mul(0.08)).clamp())
    const silk = mix(backdrop, dusk, satin.mul(0.16).add(0.035))
    const birdColor = mix(mix(color(hsl.integer(43, 89, 55)), color(hsl.integer(88, 100, 88)), identity.z.mul(0.8)), color(hsl.integer(198, 71, 78)), identity.y.mul(0.32).add(grazing.mul(0.18)).clamp())
    const surface = mix(silk, birdColor, flock)
    const relief = flock.mul(0.0017).add(warpWeave.mul(near).mul(0.0002))
    this.colorNode = surface
    this.metalness = 0.12
    this.roughnessNode = float(0.39).sub(satin.mul(0.1)).add(crossWeave.mul(0.035)).clamp(0.18, 0.52)
    this.sheen = 0.68
    this.sheenColor.set(hsl.integer(221, 33, 59))
    this.sheenRoughness = 0.3
    this.clearcoat = 0.34
    this.clearcoatRoughness = 0.085
    this.anisotropy = 0.86
    this.positionNode = p.add(normalLocal.mul(bird.mul(0.00115)))
    this.normalNode = proceduralNormal(relief, 0.72)
    this.emissiveNode = birdColor.mul(flock).mul(grazing.pow(3.1).mul(0.28).add(intimate.mul(0.045)))
  }
}
