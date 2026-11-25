import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Stained glass bent into an impossible knot: jewel panes in lead cames glow as if midnight mass were lit inside, each pane breathing at its own pace while the leading stays cold, dark and metallic. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, near, intimate} = viewerFrame()
    const boundary = cellularBoundary(p.mul(6.5))
    const lead = filteredRibbon(boundary, 0.05)
    const pane = lead.oneMinus()
    const identity = cellNoiseVec3(p.mul(6.5).floor())
    const ruby = color(hsl.integer(19, 94, 37))
    const sapphire = color(hsl.integer(264, 90, 31))
    const amberGlass = color(hsl.integer(68, 94, 65))
    const emeraldGlass = color(hsl.integer(157, 98, 43))
    const violetGlass = color(hsl.integer(298, 80, 33))
    let jewel = mix(ruby, sapphire, identity.x.smoothstep(0.2, 0.38))
    jewel = mix(jewel, amberGlass, identity.x.smoothstep(0.38, 0.56))
    jewel = mix(jewel, emeraldGlass, identity.x.smoothstep(0.56, 0.74))
    jewel = mix(jewel, violetGlass, identity.x.smoothstep(0.74, 0.9))
    const streaks = mx_noise_float(p.mul(48)).mul(0.5).add(0.5)
    this.colorNode = mix(jewel.mul(streaks.mul(0.25).add(0.82)), color(hsl.integer(275, 9, 11)), lead)
    this.transmission = 0.22
    this.thickness = 0.3
    this.ior = 1.52
    this.dispersion = 0.3
    this.metalnessNode = lead.mul(0.92)
    this.roughnessNode = float(0.32).sub(pane.mul(0.14)).add(identity.y.mul(0.12)).sub(lead.mul(-0.08)).clamp(0.1, 0.45)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    const glassNormal = proceduralNormal(lead.mul(0.35).add(streaks.mul(pane).mul(0.1).mul(intimate.add(0.3))), 0.7)
    this.normalNode = glassNormal
    const candle = time.mul(Math.PI).add(identity.z.mul(24)).sin().mul(0.14).add(0.86)
    this.emissiveNode = jewel
      .mul(pane)
      .mul(candle)
      .mul(facing.mul(0.35).add(near.mul(0.45)).add(0.38))
      .add(color(hsl.integer(275, 100, 87)).mul(lead).mul(facing.pow(3)).mul(0.06))
  }
}
