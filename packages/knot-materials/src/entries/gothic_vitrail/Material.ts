import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
// Coordinate layout of repeating Gothic rose window medallions
    const u = tube.x.mul(16)
    const v = tube.y.mul(4)
    const windowUv = vec2(u.fract().sub(0.5), v.fract().sub(0.5))
    const r = windowUv.length()
    const theta = atan(windowUv.y, windowUv.x)
// Gothic architectural tracery and lead cames
// Concentric lead came boundary rings
    const outerRing = r.sub(0.46).abs().smoothstep(0.024, 0.006)
    const midRing = r.sub(0.27).abs().smoothstep(0.02, 0.005)
    const innerRing = r.sub(0.11).abs().smoothstep(0.016, 0.004)
// 8 radial structural lead came spokes
    const radialSpokes = theta.mul(8).sin().abs().mul(r).smoothstep(0.018, 0.004)
// 8 outer lancet / trefoil petal lobes
    const petalPhase = theta.mul(8).cos()
    const petalCurve = r.sub(float(0.36).add(petalPhase.mul(0.055))).abs().smoothstep(0.018, 0.005)
// Center 4-lobed rosette tracery
    const centerRosette = theta.mul(4).cos().abs().mul(r).smoothstep(0.012, 0.003).mul(r.smoothstep(0.12, 0.03))
// Combined lead came matrix
    let isCame = outerRing.max(midRing)
    isCame = isCame.max(innerRing)
    isCame = isCame.max(radialSpokes)
    isCame = isCame.max(petalCurve)
    isCame = isCame.max(centerRosette)
    isCame = isCame.clamp(0, 1)
    const isGlass = float(1).sub(isCame)
// Pot-metal medieval glass colors
// Authentic Chartres cathedral cobalt blue
    const chartresBlue = color(hsl.integer(264.7, 96, 31.3))
// Sacred ruby red
    const sacredRuby = color(hsl.integer(22.6, 99, 47.6))
// Cathedral emerald green
    const cathedralEmerald = color(hsl.integer(152, 99, 56))
// Stained glass amber gold
    const stainedAmber = color(hsl.integer(61, 98, 68.4))
// Royal amethyst purple
    const royalAmethyst = color(hsl.integer(305, 91, 38))
// Sector angle partitioning for outer ring petals
    const sectorFloat = theta.mul(4 / Math.PI).add(4)
    const sectorId = sectorFloat.floor().mod(4)
    const s0 = sectorId.equal(0)
    const s1 = sectorId.equal(1)
    const s2 = sectorId.equal(2)
    const petalColor = s0.select(sacredRuby, s1.select(cathedralEmerald, s2.select(stainedAmber, royalAmethyst)))
// Middle ring is radiant Chartres blue
    const inInnerRing = r.smoothstep(0.11, 0.1)
    const inOuterRing = r.smoothstep(0.46, 0.44).mul(float(1).sub(r.smoothstep(0.27, 0.25)))
    let glassColor = mix(chartresBlue, petalColor, inOuterRing)
    glassColor = mix(glassColor, stainedAmber, inInnerRing)
// Antique hand-blown glass seeds (microscopic air bubbles) and thickness irregularities
    const glassWaviness = mx_noise_float(p.mul(9).add(vec3(0.5, 1.2, 0.8))).mul(0.2)
    const seedCoord = p.mul(130)
    const seedBubble = mx_noise_float(seedCoord).smoothstep(0.78, 0.85).mul(isGlass).mul(near)
// Drifting dust motes in cathedral sunbeams
    const moteCoord = p.mul(40).add(vec3(time.mul(0.02), time.mul(0.05), time.mul(-0.015)))
    const dustMotes = mx_noise_float(moteCoord).smoothstep(0.72, 0.82).mul(isGlass).mul(near.mul(0.8).add(0.4))
// Weathered dark oxidized lead came
    const cameColor = color(hsl.integer(271, 14, 12))
    const cameRoughness = float(0.68)
    const cameMetalness = float(0.45)
    this.colorNode = mix(cameColor, glassColor, isGlass)
    this.metalnessNode = mix(cameMetalness, float(0.02), isGlass)
    this.roughnessNode = mix(cameRoughness, float(0.08).add(glassWaviness), isGlass)
// Translucent cathedral glass physical properties
    this.transmission = 0.82
    this.thickness = 0.65
    this.ior = 1.52
    this.dispersion = 0.4
    this.attenuationColor.set(hsl.integer(81, 66, 80))
    this.attenuationDistance = 1.8
// Glass clearcoat
    this.clearcoat = 0.95
    this.clearcoatRoughness = 0.02
    this.iridescence = 0.35
    this.iridescenceThicknessNode = grazing.mul(300).add(160)
// Normal map: raised lead cames holding the recessed glass panels
    const cameRelief = isCame.mul(0.0042).sub(seedBubble.mul(0.0012)).add(glassWaviness.mul(isGlass).mul(0.001))
    this.normalNode = proceduralNormal(cameRelief, 0.92)
// Divine morning sun transmission through the glass
    const divineSun = facing.pow(1.6).mul(1.8).add(0.3)
    const sacredGlow = glassColor.mul(divineSun).mul(isGlass)
    this.emissiveNode = sacredGlow.mul(2.2)
      .add(sacredGlow.mul(sacredGlow).mul(1.4))
      .add(color(hsl.integer(91, 100, 93)).mul(dustMotes).mul(2.8))
      .add(stainedAmber.mul(inInnerRing).mul(facing.pow(2)).mul(isGlass).mul(1.2))
      .add(glassColor.mul(rim).mul(grazing.pow(2)).mul(0.4))
      .add(sacredRuby.mul(intimate).mul(isGlass).mul(0.2))
  }
}
