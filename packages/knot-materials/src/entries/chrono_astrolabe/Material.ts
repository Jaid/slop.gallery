import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const {facing, grazing, rim, near} = viewerFrame()
    const tube = uv()
// Coordinate framing for horological movement bridges and wheel trains
    const plateU = tube.x.mul(18)
    const plateV = tube.y.mul(4)
    const cellId = vec2(plateU.floor(), plateV.floor())
    const cellUv = vec2(plateU.fract().sub(0.5), plateV.fract().sub(0.5))
    const r = cellUv.length()
    const theta = atan(cellUv.y, cellUv.x)
// Côtes de Genève (Geneva stripes): alternating brushed rhodium bridges
    const stripePhase = tube.x.mul(54).add(tube.y.mul(14))
    const stripe = stripePhase.sin()
    const stripePattern = stripe.mul(0.5).add(0.5)
// Alternating rotation directions for interlocking gear trains
    const parity = cellId.x.add(cellId.y).mod(2)
    const rotDir = mix(float(1), float(-1), parity)
    const gearRot = theta.add(time.mul(rotDir).mul(0.75))
// Gear wheel profile with 14 teeth
    const teeth = 14
    const toothShape = gearRot.mul(teeth).cos().pow(2)
    const gearOuterRadius = float(0.32).add(toothShape.mul(0.045))
    const isGear = r.smoothstep(gearOuterRadius.add(0.01), gearOuterRadius.sub(0.01))
// 5-spoke cutout pattern inside the gear wheels
    const spokeAngle = gearRot.mul(5).cos().abs()
    const spokeHole = spokeAngle.smoothstep(0.2, 0.45).mul(r.smoothstep(0.13, 0.17)).mul(float(0.29).sub(r).smoothstep(0, 0.035))
    const gearBody = isGear.mul(float(1).sub(spokeHole))
// Sunburst circular-grain finish on gear wheels
    const sunburst = gearRot.mul(48).cos().mul(0.5).add(0.5)
// Polished ruby jewel bearings (synthetic corundum) at gear pivots
    const jewelRadius = 0.075
    const isJewel = r.smoothstep(jewelRadius + 0.006, jewelRadius - 0.006)
// Gold chaton setting ring around the ruby jewel
    const isChaton = r.smoothstep(0.108, 0.102).mul(float(1).sub(isJewel))
// Flame-blued steel screws at plate corners
    const cornerUv = cellUv.abs().sub(0.42)
    const cornerR = cornerUv.length()
    const isScrew = cornerR.smoothstep(0.052, 0.044)
    const isScrewSlot = cornerUv.y.abs().smoothstep(0.012, 0.006).mul(cornerUv.x.abs().smoothstep(0.045, 0.038).oneMinus())
    const screwHead = isScrew.mul(float(1).sub(isScrewSlot))
// Balance wheel escapement ticking rhythm (4 Hz / 8 ticks per second)
    const tickCycle = time.mul(8).fract()
    const tickFlash = float(1).sub(tickCycle).pow(5).mul(parity)
// Material palettes
// Rhodium plate bridges with alternating anisotropic reflection
    const rhodiumLight = color(hsl.integer(265, 14, 86))
    const rhodiumDark = color(hsl.integer(266, 14, 71))
    const rhodiumPlate = mix(rhodiumDark, rhodiumLight, stripePattern)
// Gilded brass gears (18k warm gold) with radial sunburst
    const goldBase = color(hsl.integer(86, 81, 75.6))
    const goldHighlight = color(hsl.integer(98, 100, 94.7))
    const gildedGear = mix(goldBase, goldHighlight, sunburst.mul(0.4))
// Blued steel for screws and click springs
    const bluedSteel = color(hsl.integer(264, 91, 30.8))
// Deep pigeon-blood ruby with internal light bounce
    const rubyCore = color(hsl.integer(22, 99, 41.7))
    const rubyFacet = color(hsl.integer(12, 99, 60))
    const rubyColor = mix(rubyCore, rubyFacet, facing.pow(2))
// Chatons: polished 24k yellow gold
    const chatonGold = color(hsl.integer(90, 88, 83))
// Composite color
    let compColor = rhodiumPlate
    compColor = mix(compColor, gildedGear, gearBody)
    compColor = mix(compColor, chatonGold, isChaton)
    compColor = mix(compColor, rubyColor, isJewel)
    compColor = mix(compColor, bluedSteel, screwHead)
    this.colorNode = compColor
// Physical properties
// Metalness: all watch plates and gears are pure polished metal except the ruby gemstone
    const isMetal = float(1).sub(isJewel)
    this.metalnessNode = isMetal.mul(0.96)
// Roughness: specular variation between Geneva stripes, gear teeth and polished jewels
    const stripeRoughness = mix(float(0.12), float(0.32), stripePattern)
    const gearRoughness = mix(float(0.18), float(0.08), sunburst)
    let compRoughness = stripeRoughness
    compRoughness = mix(compRoughness, gearRoughness, gearBody)
    compRoughness = mix(compRoughness, float(0.06), isChaton)
    compRoughness = mix(compRoughness, float(0.03), isJewel)
    compRoughness = mix(compRoughness, float(0.05), screwHead)
    this.roughnessNode = compRoughness
// High-end clearcoat for protective horological sapphire crystal
    this.clearcoat = 0.95
    this.clearcoatRoughness = 0.02
    this.anisotropy = 0.85
    this.anisotropyRotation = Math.PI * 0.25
// Surface normal relief: engraved bevels, sunken screw heads, raised gear teeth and chatons
    const plateRelief = stripe.mul(0.001)
    const gearRelief = gearBody.mul(0.0035)
    const screwRelief = screwHead.mul(-0.002).sub(isScrewSlot.mul(0.003))
    const jewelRelief = isJewel.mul(0.004).add(isChaton.mul(0.002))
    const height = plateRelief.add(gearRelief).add(screwRelief).add(jewelRelief)
    this.normalNode = proceduralNormal(height, 0.85)
// Gemstone glints and escapement pulse
    const rubyNormal = transformNormalToView(vec3(cellUv.x, cellUv.y, 0.5).normalize())
    const rubyGlint = glints(rubyNormal, 90).mul(isJewel)
    this.emissiveNode = rubyFacet.mul(rubyGlint).mul(2.2)
      .add(color(hsl.integer(18, 100, 58.5)).mul(isJewel).mul(facing.pow(3)).mul(0.85))
      .add(goldHighlight.mul(tickFlash).mul(gearBody).mul(near).mul(0.6))
      .add(color(hsl.integer(240, 100, 83)).mul(screwHead).mul(facing.pow(4)).mul(0.4))
      .add(color(hsl.integer(92, 46, 92)).mul(rim).mul(grazing.pow(3)).mul(0.15))
  }
}
