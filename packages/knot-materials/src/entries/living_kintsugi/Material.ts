import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
// Domain warping for organic ceramic fracture paths
    const warp = vec3(
      mx_noise_float(p.mul(2.8).add(vec3(0.5, 1.2, 2.3))),
      mx_noise_float(p.mul(2.8).add(vec3(4.1, 2.7, 0.8))),
      mx_noise_float(p.mul(2.8).add(vec3(1.7, 3.9, 5.4))),
    ).mul(0.18)
    const warpedP = p.add(warp)
// Major ceramic fracture lines from Voronoi boundaries
    const boundaryDist = cellularBoundary(warpedP.mul(5.2))
    const majorVein = boundaryDist.smoothstep(0.002, 0.042).oneMinus()
    const veinCore = boundaryDist.smoothstep(0.001, 0.016).oneMinus()
// Delicate craquelure spiderwebs in the porcelain substrate beneath the lacquer
    const fineDist = cellularBoundary(p.mul(24))
    const fineCraquelure = fineDist.smoothstep(0.002, 0.014).oneMinus().mul(near)
// Molten liquid gold flow dynamics along the fractures
    const flowPhase = p.dot(vec3(3.2, 5.1, 2.4)).mul(8).sub(time.mul(0.75))
    const flowPulse = flowPhase.sin().mul(0.5).add(0.5)
// Deep biological heartbeat rhythm (approx 50 bpm)
    // GPU pow is not defined for negative bases, even with an even integer exponent.
    const heartbeat = time.mul(1.6).sin().abs().pow(6)
    const incandescentHeat = veinCore.mul(heartbeat.mul(0.5).add(0.75)).add(flowPulse.mul(veinCore).mul(0.35))
// Maki-e gold leaf micro-powder floating near the seams
    const makiCoord = p.mul(160)
    const makiNoise = mx_noise_float(makiCoord)
    const makiProximity = boundaryDist.smoothstep(0.01, 0.16).oneMinus()
    const makiDust = makiNoise.smoothstep(0.68, 0.78).mul(makiProximity).mul(near.mul(0.75).add(0.25))
// Surface colors
// Deep mirror-polished urushi lacquer with oxblood red undertones
    const oxbloodUnder = mx_noise_float(p.mul(3.5)).mul(0.5).add(0.5)
    const urushiBase = mix(color(hsl.integer(345, 25, 3)), color(hsl.integer(16, 60, 7)), oxbloodUnder.mul(0.25))
    const craquelureTint = color(hsl.integer(15, 50, 12))
    const urushiSurface = mix(urushiBase, craquelureTint, fineCraquelure.mul(0.6))
// Living gold thermal gradient
    const cooledGold = color(hsl.integer(77, 86, 59))
    const moltenGold = color(hsl.integer(83.3, 100, 82.2))
    const whiteHotCore = color(hsl.integer(91, 100, 97.2))
    const goldGradient = mix(cooledGold, moltenGold, flowPulse)
    const thermalBlend = incandescentHeat.clamp()
    const activeGold = mix(goldGradient, whiteHotCore, thermalBlend)
// Composite surface color
    let compColor = urushiSurface
    compColor = mix(compColor, activeGold, majorVein)
    compColor = mix(compColor, color(hsl.integer(90.4, 100, 87.6)), makiDust.mul(0.8))
    this.colorNode = compColor
// Physical properties
// Metalness: mirror gold veins vs deep non-metallic urushi resin
    const goldMetalness = majorVein.mul(0.95).add(makiDust.mul(0.85)).clamp()
    this.metalnessNode = goldMetalness
// Roughness: glossy urushi resin (0.15) with molten metallic sheen (0.05) and maki-e specks
    const lacquerRoughness = mix(float(0.18), float(0.06), oxbloodUnder.mul(0.2))
    const goldRoughness = mix(float(0.14), float(0.04), thermalBlend)
    let compRoughness = lacquerRoughness
    compRoughness = mix(compRoughness, goldRoughness, majorVein)
    compRoughness = mix(compRoughness, float(0.03), makiDust)
    this.roughnessNode = compRoughness
// Genuine Japanese Urushi multi-coat high clearcoat
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
// Raised bead relief: artisan gold lacquer mending stands proud of the surface
    const seamHeight = majorVein.mul(0.0038).add(fineCraquelure.mul(0.0006)).add(makiDust.mul(0.0008))
    this.normalNode = proceduralNormal(seamHeight, 0.92)
// Maki-e gold sparkle glints
    const sparkle = glints(normalViewGeometry, 120).mul(makiDust).mul(near)
// Glowing incandescent heart emission
    this.emissiveNode = activeGold.mul(incandescentHeat).mul(majorVein).mul(2.2)
      .add(color(hsl.integer(0, 0, 100)).mul(veinCore).mul(incandescentHeat.pow(2)).mul(1.8))
      .add(color(hsl.integer(94, 100, 92.6)).mul(sparkle).mul(3))
      .add(color(hsl.integer(53, 100, 69.8)).mul(majorVein).mul(facing.pow(3)).mul(0.4))
      .add(color(hsl.integer(21, 84, 29)).mul(fineCraquelure).mul(intimate).mul(0.25))
      .add(color(hsl.integer(70, 100, 77)).mul(rim).mul(grazing.pow(4)).mul(0.2))
  }
}
