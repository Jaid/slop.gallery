import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Etched watered steel. Dark rivers stay matte, silver ridges take the light, and a pale hamon moves its color as the blade turns. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.62)
    this.name = knotData.id
    const {p, facing, grazing, view, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.5, 4.6).oneMinus()
    const tube = uv()
    const warp = mx_noise_float(p.mul(2.6).add(vec3(time.mul(0.06), time.mul(0.025), time.mul(-0.035))))
    const flow = tube.y.mul(TAU * 4).add(tube.x.mul(TAU * 2)).add(warp.mul(1.8))
    const flowFine = tube.y.mul(TAU * 8).add(tube.x.mul(TAU * 3)).sub(warp.mul(1.1))
    const watered = opticalBands(flow).mul(0.72).add(opticalBands(flowFine).mul(0.28))
    const etch = watered.smoothstep(0.32, 0.74)
    const hamonField = tube.y.mul(TAU).sin().add(tube.x.mul(TAU * 3).sin().mul(0.34)).add(warp.mul(0.7))
    const hamon = filteredRibbon(hamonField, 0.22)
    const hardened = hamonField.smoothstep(-0.35, 0.85)
    const steel = mix(color(hsl.integer(262, 17, 5)), color(hsl.integer(251, 23, 88)), etch)
    const tempered = mix(steel.mul(0.62), steel, hardened.mul(0.75).add(0.25))
    const glance = view.y.abs().oneMinus().mul(facing)
    const blueSteel = mix(tempered, mix(tempered, color(hsl.integer(254, 42, 70)), 0.7), glance.mul(0.85))
    const warmEdge = mix(blueSteel, mix(blueSteel, color(hsl.integer(61, 59, 78)), 0.55), grazing.pow(1.2).mul(0.7))
    this.colorNode = mix(warmEdge, color(hsl.integer(248, 100, 98.4)), hamon.mul(0.78))
    this.metalnessNode = float(0.72).add(etch.mul(0.26)).clamp(0, 1)
    this.roughnessNode = float(0.58).sub(etch.mul(0.34)).sub(hamon.mul(0.12)).add(grazing.mul(0.04)).clamp(0.12, 0.68)
    this.anisotropyNode = vec2(float(0.35).add(etch.mul(0.55)), 0)
    this.clearcoat = 0.08
    this.clearcoatRoughness = 0.3
    const speckScale = p.mul(58)
    const specks = cellularPoints(speckScale, 0.016, 0.055, 0.88)
    const speckFade = speckScale.fwidth().length().smoothstep(0.55, 0.16).oneMinus()
    this.emissiveNode = color(hsl.integer(232, 100, 98)).mul(hamon).mul(grazing.mul(0.55).add(0.2)).mul(0.42)
      .add(color(hsl.integer(84, 100, 97)).mul(specks).mul(speckFade).mul(proximity).mul(facing.pow(2)).mul(1.4))
    const relief = flow.sin().mul(0.5).add(0.5)
    this.normalNode = proceduralNormal(etch.add(hamon), 0.016)
    this.positionNode = p.add(normalLocal.mul(relief.sub(0.5).mul(0.007)))
  }
}
