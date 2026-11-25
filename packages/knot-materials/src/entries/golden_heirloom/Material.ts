import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, uv, vec2, vec3} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Porcelain mended with gold. A warm ivory glaze carries deep cobalt underglaze painting — a broken brush band, fine double lines and scattered plum rings that wrap the tube seamlessly — while a noise-warped fracture network is filled with satin gold that sits a hair proud of the surface under clear lacquer. The gold is true metal: dull umber in shadow, igniting as you walk the highlight across it. Hairline crackle, gold dust and wheel-throwing lines only resolve up close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, near, intimate} = viewerFrame()
    const brush = mx_noise_float(p.mul(7)).mul(0.5).add(0.5)
    const brushFine = mx_noise_float(p.mul(23)).mul(0.5).add(0.5)
    // Warm ivory porcelain with celadon pooling in the quiet patches.
    const blush = mx_noise_float(p.mul(2.2)).mul(0.5).add(0.5)
    let porcelain = mix(color(hsl.integer(87, 29, 90)), color(hsl.integer(89, 43, 96)), blush)
    porcelain = mix(porcelain, color(hsl.integer(138, 18, 84)), blush.smoothstep(0.58, 0.85).mul(0.45))
    // Cobalt band flowing along one flank of the tube, broken like dry brushwork and
    // edged by a hand-drawn double line. Soft wash patches settle between the motifs.
    // The paint layer is sampled a breath beneath the glaze, so it parallaxes under it.
    const paintTube = tube.add(tubeRay().mul(0.015))
    const bandCenter = paintTube.y.sub(0.3).add(mx_noise_float(p.mul(5)).mul(0.035))
    const bandDist = bandCenter.fract().sub(0.5).abs()
    const dryBrush = mx_noise_float(p.mul(4.2).add(7.7)).mul(0.5).add(0.5).smoothstep(0.25, 0.55)
    const band = bandDist.smoothstep(0.085, 0.125).oneMinus().mul(dryBrush.mul(0.75).add(0.25))
    const bandLine = hairline(bandDist.sub(0.165), 0.006)
    const wash = mx_noise_float(p.mul(2.6).add(3.3)).mul(0.5).add(0.5).smoothstep(0.6, 0.85)
    // Plum blossoms painted in a seamless wrapped lattice: five petals around a heart,
    // each flower gated, jittered and turned by its own hand.
    const motifGrid = vec2(paintTube.x.mul(88), paintTube.y.mul(10))
    const motifCell = wrapCell(motifGrid.floor(), vec2(88, 10))
    const motifRandom = cellNoiseVec3(vec3(motifCell.x, motifCell.y, 5.1))
    const motifLocal = motifGrid.fract().sub(motifRandom.xy.mul(0.5).add(0.25))
    const motifDist = motifLocal.length().add(mx_noise_float(p.mul(30)).mul(0.025))
    const motifGate = motifRandom.z.smoothstep(0.52, 0.68)
    const turn = motifRandom.x.mul(TAU)
    const turnedX = motifLocal.x.mul(turn.cos()).sub(motifLocal.y.mul(turn.sin()))
    const turnedY = motifLocal.x.mul(turn.sin()).add(motifLocal.y.mul(turn.cos()))
    let petalDist: Node<'float'> = float(10)
    for (let petal = 0; petal < 5; petal++) {
      const direction = petal / 5 * TAU
      petalDist = petalDist.min(vec2(turnedX.sub(Math.cos(direction) * 0.16), turnedY.sub(Math.sin(direction) * 0.16)).length())
    }
    const plum = petalDist.smoothstep(0.035, 0.065).oneMinus().add(motifDist.smoothstep(0.04, 0.075).oneMinus().mul(0.9)).clamp().mul(motifGate)
    const cobaltPaint = band.mul(0.92).max(bandLine).max(plum.mul(0.9)).max(wash.mul(0.12))
    const cobaltColor = mix(color(hsl.integer(264, 84, 14)), color(hsl.integer(264, 88, 34)), brushFine)
    porcelain = mix(porcelain, cobaltColor, cobaltPaint.mul(brush.mul(0.2).add(0.85)))
    // The fracture network, warped by two noise octaves so no crack runs dead straight:
    // hand-varied gold veins, a dusting of gold around them, and dark-stained crackle in
    // stress clusters that only a close look can resolve.
    const warp = vec3(mx_noise_float(p.mul(3.9).add(13.7)), mx_noise_float(p.mul(3.9).add(47.3)), mx_noise_float(p.mul(3.9).add(91.1))).mul(0.16)
    const warped = p.add(warp)
    const veinField = cellularBoundary(warped.mul(3.4))
    const veinWidth = mx_noise_float(p.mul(4.5)).mul(0.007).add(0.011)
    const goldMask = filteredRibbon(veinField, veinWidth)
    const goldDust = filteredRibbon(veinField, veinWidth.mul(2.2))
    const cluster = mx_noise_float(p.mul(1.8)).mul(0.5).add(0.5).smoothstep(0.45, 0.75)
    const crackle = filteredRibbon(cellularBoundary(warped.mul(12.5)), 0.011).mul(near).mul(cluster.mul(0.65).add(0.35))
    const goldColor = mix(color(hsl.integer(78, 87, 50)), color(hsl.integer(91, 86, 84.5)), brushFine)
    let surface = mix(porcelain, color(hsl.integer(70, 23, 40)), crackle.mul(0.26))
    surface = mix(surface, goldColor, goldDust.mul(0.1))
    surface = mix(surface, goldColor, goldMask)
    this.colorNode = surface
    this.metalnessNode = goldMask.mul(0.95)
    this.envMapIntensity = 1.5
    this.roughnessNode = mix(mix(float(0.1), float(0.2), cobaltPaint), float(0.14).add(brushFine.mul(0.12)), goldMask).add(crackle.mul(0.12))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.aoNode = float(1).sub(crackle.mul(0.3)).sub(goldMask.mul(0.12))
    // Gold sits proud of the glaze as a rounded bead; crackle and throwing lines sink in.
    const throwing = opticalBands(tube.y.mul(TAU * 46)).sub(0.5)
    const goldDome = veinField.div(veinWidth.mul(2.4)).pow2().oneMinus().max(0).sqrt()
    const height = goldDome.mul(0.9).sub(crackle.mul(0.15)).add(throwing.mul(0.05).mul(intimate))
    this.normalNode = proceduralNormal(height, 0.002)
    // No fire in the gold — only the faintest warmth so shadowed veins keep their body,
    // plus a hard lamp glint that runs along the veins as the viewer moves.
    const veinGlint = glints(normalViewGeometry, 48).mul(goldMask)
    this.emissiveNode = color(hsl.integer(64, 100, 74)).mul(goldMask).mul(facing).mul(0.035)
      .add(color(hsl.integer(85, 100, 88.5)).mul(veinGlint).mul(0.85))
  }
}
