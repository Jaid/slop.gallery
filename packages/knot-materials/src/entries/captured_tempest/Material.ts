import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec2, vec3} from 'three/tsl'

import {filament} from '../../candidates/gpt_sol/lib/filament.ts'
import {viewerFrame} from '../../candidates/gpt_sol/lib/viewerFrame.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

function stormBolt(q: Node<'vec3'>, seed: number) {
  const family = Math.abs(Math.floor(seed * 3)) % 3
  const axis = [
    vec3(0.27, 0.93, 0.24).normalize(),
    vec3(-0.67, 0.46, 0.58).normalize(),
    vec3(0.72, 0.2, -0.66).normalize(),
  ][family]
  const sideSeed = [
    vec3(0.91, -0.31, 0.16),
    vec3(0.3, 0.87, -0.39),
    vec3(0.15, 0.93, 0.34),
  ][family]
  const side = sideSeed
    .sub(axis.mul(sideSeed.dot(axis)))
    .normalize()
  const across = axis.cross(side).normalize()
  const along = q.dot(axis)
  const epoch = time.mul(0.78).floor()
  const jitter = mx_noise_float(vec3(along.mul(3.2), epoch.mul(0.13), seed + 2.1))
  const laneX = q
    .dot(side)
    .mul(2.7)
    .add(along
      .mul(8 + seed * 0.17)
      .sin()
      .mul(0.16))
    .add(jitter.mul(0.34))
    .add(seed * 0.271)
  const laneY = q
    .dot(across)
    .mul(2.7)
    .add(along
      .mul(6.3 + seed * 0.11)
      .cos()
      .mul(0.14))
    .sub(jitter.mul(0.26))
    .add(seed * 0.419)
  const cellX = laneX.add(0.5).fract().sub(0.5)
  const cellY = laneY.add(0.5).fract().sub(0.5)
  const distance = vec2(cellX, cellY).length()
  const footprint = distance.fwidth().max(0.001)
  const core = distance
    .smoothstep(0.018, footprint.mul(1.25).add(0.03))
    .oneMinus()
  const topology = mx_noise_float(q.mul(4.6)
    .add(vec3(seed * 2.7, seed * -4.1, seed * 5.3))
    .add(epoch.mul(0.071)))
  const gate = topology.smoothstep(-0.18, 0.24)
  const flash = time
    .mul(4.7 + seed * 0.11)
    .add(topology.mul(17))
    .sin()
    .mul(0.5)
    .add(0.5)
    .pow(9)
    .mul(0.85)
    .add(0.15)
  const forkField = cellX
    .add(cellY.mul(0.62))
    .add(along
      .mul(13 + seed)
      .sin()
      .mul(0.07))
  const fork = filament(forkField, 0.018)
  const reach = distance.smoothstep(0.09, 0.34).oneMinus()
  const survival = footprint.smoothstep(0.08, 0.3).oneMinus()
  return core
    .mul(gate)
    .mul(flash)
    .add(fork
      .mul(reach)
      .mul(gate)
      .mul(flash)
      .mul(0.35))
    .mul(survival)
    .clamp()
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.42
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const chord = facing
      .mul(0.3)
      .add(0.06)
    const drift = vec3(time.mul(0.025), time.mul(-0.06), time.mul(0.018))
    const steps = 6
    let stormGlow: Node<'vec3'> = vec3(0)
    let cloudSum: Node<'float'> = float(0)
    let veil: Node<'float'> = float(1)
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps
      const q = p.sub(view.mul(chord.mul(t)))
      const cloud = mx_noise_float(q.mul(4.2)
        .add(drift)
        .add(i * 2.73))
        .mul(0.5)
        .add(0.5)
        .smoothstep(0.5, 0.84)
      const mainBolt = stormBolt(q, i * 0.73 + 1.2)
      const fineBolt
        = i % 2 === 0 ? stormBolt(q.mul(1.72).add(4.7), i + 11.4)
          .mul(intimate)
          .mul(0.48) : float(0)
      const bolt = mainBolt
        .add(fineBolt)
        .clamp()
      const tint = mix(color(hsl.integer(266, 100, 66)), color(hsl.integer(95, 100, 97.3)), cloud
        .mul(0.35)
        .add(t * 0.65)
        .clamp())
      const depthWeight
        = 1 - Math.abs(t - 0.45) * 0.7
      stormGlow = stormGlow.add(tint
        .mul(bolt)
        .mul(veil)
        .mul(depthWeight))
      cloudSum = cloudSum.add(cloud)
      veil = veil.mul(float(1)
        .sub(cloud.mul(0.12))
        .clamp(0.78, 1))
    }
    const clouds = cloudSum.div(steps)
    this.colorNode = mix(color(hsl.integer(251, 43, 3.6)), color(hsl.integer(252, 38, 23)), clouds
      .mul(0.52)
      .add(rim.mul(0.16))
      .clamp())
    this.transmission = 1
    this.transmissionNode = float(0.82)
      .sub(clouds.mul(0.38))
      .clamp(0.3, 0.84)
    this.thickness = 0.76
    this.ior = 1.46
    this.dispersion = 0.1
    this.attenuationColor.set(hsl.integer(258, 55, 21))
    this.attenuationDistance = 0.72
    this.roughnessNode = clouds
      .mul(0.18)
      .add(0.035)
      .clamp(0.03, 0.24)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = clouds
      .mul(0.1)
      .add(0.018)
    const surfaceNoise = mx_noise_float(p.mul(18).add(drift.mul(0.2)))
    this.normalNode = proceduralNormal(surfaceNoise, 0.0008)
    const charge = near
      .mul(0.9)
      .add(0.25)
    this.emissiveNode = stormGlow
      .div(steps)
      .mul(8.5)
      .mul(charge)
      .add(color(hsl.integer(286, 69, 31))
        .mul(rim)
        .mul(0.09))
  }
}
