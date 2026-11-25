import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, time} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    // Restrained environment intensity prevents milky washing of deep black glass
    super(environment, 0.75)
    this.name = knotData.id
    const {p, rim, near, intimate} = viewerFrame()
    // Domain-warped Voronoi for organic conchoidal fractures
    const warp = mx_noise_float(p.mul(3.2)).mul(0.24)
    const voronoi = mx_worley_noise_vec3(p.mul(3.8).add(warp), 1, 0)
    const crackDist = voronoi.y.sub(voronoi.x)
    const conchoidalJitter = mx_noise_float(p.mul(28)).mul(0.015)
    const crackField = crackDist.add(conchoidalJitter)
    // Asymmetric negative space: 65% of the knot remains pristine unbroken obsidian
    const crackGate = mx_noise_float(p.mul(1.8).add(17.3)).smoothstep(0.12, 0.44)
    // Seam masks: primary lacquer joint and micro-branch fractures
    const seamWidth = 0.024
    const mainCrack = hairline(crackField, seamWidth).mul(crackGate)
    const fineCrack = hairline(crackField, 0.01).mul(crackGate)
    const goldMask = mainCrack.max(fineCrack)
    // Conchoidal fracture tilt: subtle reflection discontinuity across Voronoi boundaries
    const shardTilt = voronoi.x.sub(voronoi.y).mul(0.0018).mul(crackGate)
    // Convex proud bead profile of hand-applied urushi lacquer
    const beadProfile = goldMask.pow(0.55).mul(0.012).add(shardTilt)
    const seamNormal = proceduralNormal(beadProfile, 0.95)
    this.normalNode = seamNormal
    // Pure black volcanic obsidian with zero diffuse reflection
    const obsidianBlack = color(hsl.integer(0, 0, 0))
    // 24-karat gold leaf dusted lacquer
    const goldColor = mix(color(hsl.integer(75, 94, 71)), color(hsl.integer(90, 100, 86.5)), fineCrack.mul(0.5).add(0.5))
    this.colorNode = mix(obsidianBlack, goldColor, goldMask)
    // Physical PBR: obsidian is pure dielectric glass, gold is pure metallic conductor
    this.metalnessNode = goldMask.mul(1)
    this.roughnessNode = mix(float(0.035), float(0.09), goldMask)
    // Clearcoat is applied only over the obsidian glass; metal has direct conductor reflection
    this.clearcoat = 1
    this.clearcoatNode = goldMask.oneMinus().mul(0.95)
    this.clearcoatRoughness = 0.018
    // 24k gold leaf micro-flake sparkle
    const goldFlakes = glints(seamNormal, 90).mul(goldMask).mul(near.mul(0.6).add(0.4))
    // Thermal living luminescence in the freshly cast molten gold core
    const thermalPulse = time.mul(0.85).sin().mul(0.15).add(0.85)
    const moltenCore = mix(color(hsl.integer(39, 100, 62.4)), color(hsl.integer(97, 100, 94.2)), fineCrack)
      .mul(fineCrack)
      .mul(thermalPulse)
      .mul(intimate.mul(0.7).add(0.3))
      .mul(1.4)
    const flakeSparkle = color(hsl.integer(95, 100, 96)).mul(goldFlakes).mul(1.8)
    const goldRimGleam = color(hsl.integer(81, 100, 81.9)).mul(rim.pow(3)).mul(goldMask).mul(0.6)
    this.emissiveNode = moltenCore
      .add(flakeSparkle)
      .add(goldRimGleam)
  }
}
