import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalViewGeometry, time} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {p, near, intimate, facing, rim} = viewerFrame()
    // Domain-warped fracture coordinates to simulate organic porcelain breakage
    const warp = mx_noise_vec3(p.mul(2.2)).mul(0.35)
    const pWarp = p.add(warp)
    // Primary fracture seams
    const seamField = cellularBoundary(pWarp.mul(3.6))
    const seamWidth = float(0.016)
    const seamFootprint = seamField.fwidth().max(0.0001)
    const goldMask = seamField.smoothstep(seamWidth, seamWidth.add(seamFootprint.mul(1.2)).add(0.01)).oneMinus()
    const goldBead = seamField.smoothstep(float(0.008), float(0.06)).oneMinus()
    // Secondary micro-crazing (crackle glaze) revealed on close inspection
    const crazeField = cellularBoundary(p.mul(32))
    const crazing = hairline(crazeField, 0.002).mul(near).mul(0.35)
    // Lapis lazuli mineral specks within the gold seams
    const speckCoord = p.mul(84)
    const speckNoise = cellNoiseVec3(speckCoord)
    const isLapis = speckNoise.x.smoothstep(0.82, 0.85).mul(goldMask)
    const lapisColor = color(hsl.integer(265, 94, 30))
    // 24k molten gold lacquer color variation
    const goldTone = mx_noise_float(p.mul(18)).mul(0.5).add(0.5)
    const goldColor = mix(color(hsl.integer(75, 96.6, 74)), color(hsl.integer(93, 100, 89)), goldTone)
    const seamColor = mix(goldColor, lapisColor, isLapis.mul(near))
    // Imperial bone-china celadon porcelain body
    const porcelainNoise = mx_noise_float(p.mul(4.5)).mul(0.5).add(0.5)
    const porcelainBase = mix(color(hsl.integer(87, 35, 96.6)), color(hsl.integer(157, 23, 93)), porcelainNoise.mul(0.12))
    const porcelainWithCrazing = mix(porcelainBase, color(hsl.integer(168, 17, 74)), crazing)
    // Surface properties
    this.colorNode = mix(porcelainWithCrazing, seamColor, goldMask)
    this.metalnessNode = goldMask.mul(0.98)
    this.roughnessNode = mix(float(0.11), float(0.16), goldMask)
    // Eggshell porcelain sheen
    this.sheen = 0.4
    this.sheenColor.set(hsl.integer(77, 100, 98))
    this.sheenRoughness = 0.35
    // Glassy clearcoat glaze
    this.clearcoat = 1
    this.clearcoatRoughness = 0.028
    // Procedural normal: physically elevated bead of lacquer along the gold seam
    const beadHeight = goldBead.pow(1.6).mul(0.0035).add(crazing.mul(-0.0004))
    this.normalNode = proceduralNormal(beadHeight, 0.85)
    // Sparkle from crushed gold dust and lapis crystals
    const grainNormal = normalViewGeometry.add(speckNoise.sub(0.5).mul(0.55)).normalize()
    const goldSparkle = glints(grainNormal, 120).mul(goldMask).mul(near.mul(0.7).add(0.3))
    // Molten golden respiration from within the deep fissures
    const goldenPulse = time.mul(1.4).sin().mul(0.5).add(0.5)
    const innerHeat = color(hsl.integer(60, 100, 72.1)).mul(goldMask).mul(goldenPulse.mul(0.45).add(0.55)).mul(intimate).mul(0.85)
    // Subtle porcelain translucent glow at grazing edges
    const porcelainRim = color(hsl.integer(166, 33, 89.5)).mul(rim.pow(2)).mul(facing.mul(0.2).add(0.8)).mul(0.12)
    this.emissiveNode = innerHeat
      .add(color(hsl.integer(98, 100, 96.8)).mul(goldSparkle).mul(1.6))
      .add(porcelainRim)
  }
}
