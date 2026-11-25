import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    this.envMapIntensity = 0.14
    const p = positionGeometry
    const {view, facing, grazing, near, intimate} = viewerFrame()
    // Two warped contour fields make a hierarchy of old fractures. The shallow field remains legible
    // from across the gallery; the hairline branches wake up only as the visitor approaches the glaze.
    const parallax = p.sub(view.mul(0.055))
    const geological = mx_noise_float(parallax.mul(4.2).add(vec3(3.7, -8.1, 2.4)))
    const fractureField = mx_noise_float(parallax.mul(8.2).add(vec3(11.4, 2.7, -5.9))).add(geological.mul(0.24))
    const fracture = opticalLine(fractureField, 0.052)
    const halo = opticalLine(fractureField, 0.14).mul(0.5)
    const shardBoundary = cellularBoundary(parallax.mul(2.7)).sub(0.075)
    const shardCracks = opticalLine(shardBoundary, 0.034)
    const shardCells = cellNoiseVec3(parallax.mul(2.7).floor().add(13.7))
    const sparseShards = shardCells.x.smoothstep(0.52, 0.76)
    const branchField = mx_noise_float(parallax.mul(17.5).add(geological.mul(2.8)).add(vec3(-4.3, 7.1, 13.2)))
    const branches = opticalLine(branchField, 0.032).mul(near.mul(0.78).add(0.22))
    const hairField = mx_noise_float(p.sub(view.mul(0.16)).mul(34).add(vec3(9.2, -3.1, 6.8)))
    const hair = opticalLine(hairField, 0.02).mul(near)
    const crack = fracture.mul(0.08).add(shardCracks.mul(sparseShards).mul(1.55)).add(branches.mul(0.12)).add(hair.mul(0.05)).clamp()
    // A derivative-free companion is reserved for vertex relief; screen filtering stays in the fragment mask.
    const structuralGold = shardBoundary.abs().smoothstep(0.12, 0.028).oneMinus().mul(sparseShards)
    // Gold is not simply painted on: it turns into a thin sunrise at grazing angles and carries a
    // slow traveling glint, so a second visit from another side never repeats the same impression.
    const gaze = view.dot(vec3(0.61, -0.32, 0.72).normalize()).mul(0.5).add(0.5)
    const angleGold = grazing.pow(0.9).mul(0.72).add(facing.mul(0.22)).add(gaze.mul(0.18)).clamp()
    const goldMask = crack.mul(angleGold.mul(0.94).add(0.06)).clamp()
    const pulse = p.dot(vec3(3.4, -4.1, 5.7)).mul(4.5).add(time.mul(0.58)).sin().mul(0.5).add(0.5).pow(8).mul(crack).mul(intimate)
    const porcelainNoise = mx_noise_float(p.mul(5.5).add(vec3(1.5, 8.4, -2.2))).mul(0.5).add(0.5)
    const ivory = mix(color(hsl.integer(278, 23, 6)), color(hsl.integer(291, 26, 24)), porcelainNoise.mul(0.35).add(facing.mul(0.38)).clamp())
    const warmth = mix(color(hsl.integer(46, 86, 16)), color(hsl.integer(85, 100, 82.8)), gaze.mul(0.55).add(grazing.mul(0.45)).clamp())
    const porcelain = mix(ivory, color(hsl.integer(284, 28, 5)), halo.mul(0.52))
    const ceramicRim = mix(porcelain, color(hsl.integer(278, 71, 2)), grazing.pow(1.15).mul(0.42))
    const surface = mix(ceramicRim, warmth, goldMask)
    const relief = halo.mul(0.0011).add(goldMask.mul(0.0014)).add(branches.mul(0.00045))
    this.colorNode = surface
    this.metalnessNode = goldMask
    this.roughnessNode = mix(float(0.42), float(0.055), goldMask).add(near.mul(-0.025)).clamp(0.025, 0.46)
    this.transmission = 0
    this.thickness = 0.3
    this.ior = 1.52
    this.attenuationColor.set(hsl.integer(77, 62, 88))
    this.attenuationDistance = 2.4
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(relief, 0.92)
    this.positionNode = p.add(normalLocal.mul(structuralGold.mul(0.0017)))
    this.emissiveNode = warmth.mul(pulse).mul(1.2).add(color(hsl.integer(65, 100, 74.3)).mul(goldMask).mul(0.42)).add(color(hsl.integer(92, 100, 89)).mul(goldMask).mul(grazing.pow(2.4)).mul(0.18))
  }
}
