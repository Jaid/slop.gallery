import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** A feather made monumental. Emerald barbs stream along the knot while staggered eyes open in the plumage: bronze and copper rings around a turquoise heart and a sapphire pupil. Tilt the feather and the hearts slide toward violet; lean in and the individual barbs, too fine to see from the doorway, resolve and shiver. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, objectDistance} = viewerFrame()
    const close = objectDistance.smoothstep(1.5, 4.8).oneMinus()
    const intimate = objectDistance.smoothstep(1.15, 3.1).oneMinus()
    const viewPhase = view.dot(vec3(0.62, 0.28, 0.73).normalize()).mul(0.5).add(0.5)
// Staggered eyes on a periodic tube lattice, so the plumage is seamless where the tube closes.
    const grid = vec2(tube.x.mul(18), tube.y.mul(3))
    const row = grid.y.floor()
    const shifted = vec2(grid.x.add(row.mod(2).mul(0.5)), grid.y)
    const cell = shifted.floor()
    const identity = cellNoiseVec3(vec3(wrapCell(cell, vec2(18, 3)), 23.7))
    const q = shifted.fract().sub(0.5)
    const breathe = time.mul(Math.PI).add(identity.x.mul(TAU)).add(tube.x.mul(TAU * 2)).sin().mul(0.5).add(0.5)
    const eyeScale = breathe.mul(0.07).add(0.94).add(identity.y.mul(0.05))
    const elliptical = vec2(q.x.div(0.95), q.y.div(0.78)).div(eyeScale)
    const radius = elliptical.length().max(0.00001)
    const aa = radius.fwidth().max(0.0001)
    const eyeBand = (edge: number) => radius.smoothstep(float(edge).sub(aa.mul(1.4)), float(edge).add(aa.mul(1.4))).oneMinus()
    const halo = eyeBand(0.455)
    const emeraldRing = eyeBand(0.36)
    const copperRing = eyeBand(0.29)
    const turquoiseHeart = eyeBand(0.22)
    const sapphireHeart = eyeBand(0.155)
    const violetCore = eyeBand(0.085)
// Barbs stream diagonally through the dark plumage and radiate faintly around every eye.
    const barbPhase = tube.x.mul(680).add(tube.y.mul(115)).add(identity.z.mul(2))
    const barb = opticalBands(barbPhase).mul(halo.oneMinus().mul(0.6).add(0.18))
    const barbRelief = barbPhase.cos().mul(0.5).add(0.5).mul(0.00022).mul(close.mul(0.65).add(0.35))
    const reliefBand = (edge: number) => radius.smoothstep(edge - 0.025, edge + 0.025).oneMinus()
    const eyeRelief = reliefBand(0.455).mul(0.0009).add(reliefBand(0.22).mul(0.0011)).add(reliefBand(0.155).mul(0.0007))
    const featherNormal = proceduralNormal(eyeRelief.add(barbRelief), 0.95)
    this.normalNode = featherNormal
    this.clearcoatNormalNode = featherNormal
    const darkPlumage = color(hsl.integer(165, 74, 7))
    const emerald = color(hsl.integer(156, 98.4, 43))
    const bronze = color(hsl.integer(72, 76, 49))
    const copper = color(hsl.integer(50, 79, 52))
    const turquoise = color(hsl.integer(183, 97, 66))
    const sapphire = color(hsl.integer(265, 91, 30))
    const violet = color(hsl.integer(296, 86, 21))
    let plumage = mix(darkPlumage, emerald, barb.mul(0.24).add(halo.mul(0.12)))
    plumage = mix(plumage, color(hsl.integer(171, 66, 3.5)), eyeBand(0.485).mul(halo.oneMinus()))
    plumage = mix(plumage, bronze, halo.mul(emeraldRing.oneMinus()))
    plumage = mix(plumage, emerald.mul(1.25), emeraldRing.mul(copperRing.oneMinus()))
    plumage = mix(plumage, copper, copperRing.mul(turquoiseHeart.oneMinus()))
    const shiftedHeart = mix(turquoise, sapphire, viewPhase.mul(0.42))
    plumage = mix(plumage, shiftedHeart, turquoiseHeart.mul(sapphireHeart.oneMinus()))
    plumage = mix(plumage, mix(sapphire, violet, viewPhase), sapphireHeart.mul(violetCore.oneMinus()))
    plumage = mix(plumage, color(hsl.integer(203, 100, 88.2)), violetCore.mul(0.8))
    this.colorNode = plumage
    const goldMask = halo.mul(emeraldRing.oneMinus()).add(copperRing.mul(turquoiseHeart.oneMinus()).mul(0.7))
    this.metalnessNode = goldMask.mul(0.45).add(turquoiseHeart.mul(0.08))
    this.roughnessNode = float(0.4).sub(halo.mul(0.16)).sub(goldMask.mul(0.1)).add(barb.mul(0.05)).clamp(0.16, 0.48)
    this.anisotropy = 0.88
    this.clearcoat = 0.28
    this.clearcoatRoughness = 0.24
    this.sheen = 1
    this.sheenColor.set(hsl.integer(168, 92, 80))
    this.sheenRoughnessNode = float(0.38).sub(turquoiseHeart.mul(0.12)).add(grazing.mul(0.14))
    this.iridescenceNode = turquoiseHeart.mul(0.34).add(grazing.mul(0.48)).clamp()
    this.iridescenceIOR = 1.38
    this.iridescenceThicknessNode = viewPhase.mul(280).add(turquoiseHeart.mul(150)).add(130)
    const sparkle = cellularPoints(p.mul(46), 0.018, 0.13, 0.62).mul(intimate)
    const heartPulse = breathe.mul(0.24).add(0.2)
    this.emissiveNode = turquoise.mul(turquoiseHeart.mul(sapphireHeart.oneMinus())).mul(heartPulse).mul(facing.mul(0.55).add(0.35)).mul(near.mul(0.7).add(0.55))
      .add(color(hsl.integer(85, 100, 88.5)).mul(goldMask).mul(glints(featherNormal, 170)).mul(near.mul(0.8).add(0.45)).mul(1.4))
      .add(spectralColor(viewPhase.mul(3).add(identity.x.mul(2))).mul(grazing.pow(2.4)).mul(0.13))
      .add(color(hsl.integer(200, 100, 94.3)).mul(sparkle).mul(0.65))
  }
}
