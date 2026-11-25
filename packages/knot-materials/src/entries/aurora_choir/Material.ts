import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const noise = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    // Camera position transformed into object space.
    //
    // All internal layers below are displaced along the actual camera ray
    // rather than screen UVs, so details remain anchored inside the sculpture
    // while walking around it.
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // Two distance gates.
    //
    // Major structures can be read from across the gallery. Fine structures
    // emerge continuously on approach instead of popping into existence.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const inner = p.sub(view.mul(0.16))
    const deep = p.sub(view.mul(0.28))
    const abyss = p.sub(view.mul(0.42))
    // Three translucent aurora curtains inhabit separate depths.
    //
    // The geometry of each curtain stays anchored inside the object while
    // its apparent chromatic character changes dramatically with angle.
    const drift = vec3(time.mul(0.012), time.mul(-0.03), time.mul(0.018))
    const veilA = mx_noise_float(inner.mul(vec3(3.2, 15, 4.1)).add(drift)).add(inner.x.mul(8).sin().mul(0.13))
    const veilB = mx_noise_float(deep.mul(vec3(4.5, 19, 3.1)).sub(drift.mul(1.4))).add(deep.z.mul(9).cos().mul(0.11))
    const veilC = mx_noise_float(abyss.mul(vec3(5.5, 24, 4.8)).add(drift.mul(2.1)))
    const ribbonA = opticalLine(veilA, 0.048)
    const ribbonB = opticalLine(veilB, 0.038).mul(near)
    const ribbonC = opticalLine(veilC, 0.03).mul(intimate)
    const microShimmer = opticalBands(inner.y.mul(110).add(mx_noise_float(inner.mul(8)).mul(4)).add(view.x.mul(11)).sub(view.z.mul(7))).mul(near)
    const hue = inner.y.mul(6).add(view.x.mul(7.5)).sub(view.z.mul(4.5)).add(time.mul(0.07)).sin().mul(0.5).add(0.5)
    const aurora = mix(color(hsl.integer(172, 100, 87.5)), color(hsl.integer(292, 100, 56.4)), hue)
    const deepAurora = mix(color(hsl.integer(247, 100, 66)), color(hsl.integer(316, 100, 67)), hue.oneMinus())
    this.colorNode = mix(color(hsl.integer(235, 48, 9)), color(hsl.integer(213, 71, 29)), noise.mul(0.45).add(rim.mul(0.25)).clamp())
    this.transmission = 0.7
    this.thickness = 0.5
    this.ior = 1.38
    this.attenuationColor.set(hsl.integer(205, 76, 51))
    this.attenuationDistance = 0.95
    this.roughnessNode = microShimmer.mul(0.035).add(0.07)
    this.clearcoat = 0.52
    this.clearcoatRoughness = 0.055
    this.normalNode = liquidNormal(near, 0.07)
    this.emissiveNode = aurora.mul(ribbonA).mul(near.mul(0.5).add(0.58)).add(deepAurora.mul(ribbonB).mul(0.72)).add(color(hsl.integer(181, 100, 96.6)).mul(ribbonC).mul(1.3)).add(aurora.mul(microShimmer).mul(intimate).mul(0.18)).add(color(hsl.integer(209, 96, 78)).mul(rim).mul(0.11))
  }
}
