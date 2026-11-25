import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
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
    // Four apparent physical depths.
    //
    // Walking sideways causes these layers to separate naturally through
    // parallax. Looking straight on compresses them back together.
    const depth = p.sub(view.mul(0.075))
    const inner = p.sub(view.mul(0.16))
    const deep = p.sub(view.mul(0.28))
    const abyss = p.sub(view.mul(0.42))
    // A miniature star trapped in amber.
    //
    // Slow convective plasma lives near the surface. White-hot magnetic
    // structures float further inside, while the silhouette becomes a
    // corona at steep viewing angles.
    const drift = vec3(time.mul(0.015), time.mul(-0.022), time.mul(0.01))
    const warp = mx_noise_vec3(inner.mul(5).add(drift)).mul(0.85)
    const granulation = mx_noise_float(depth.mul(28).add(warp.mul(0.5))).mul(0.5).add(0.5)
    const plasma = mx_noise_float(inner.mul(11).add(warp)).add(inner.y.mul(6).add(time.mul(0.08)).sin().mul(0.16))
    const prominences = opticalLine(plasma, 0.028)
    const corona = opticalLine(mx_noise_float(deep.mul(21).add(warp.mul(1.6))), 0.021).mul(near)
    const filaments = opticalLine(mx_noise_float(abyss.mul(34).sub(drift.mul(2))), 0.017).mul(intimate)
    const sunGlint = view.dot(vec3(-0.52, 0.74, 0.42).normalize()).abs().pow(10)
    this.colorNode = mix(color(hsl.integer(31, 96, 12)), color(hsl.integer(38, 98, 55)), granulation).add(color(hsl.integer(77, 100, 79.4)).mul(prominences).mul(0.22))
    this.transmissionNode = near.mul(0.12).add(0.54)
    this.thickness = 0.44
    this.ior = 1.61
    this.dispersion = 0.3
    this.attenuationColor.set(hsl.integer(34.3, 99, 54))
    this.attenuationDistance = 0.58
    this.roughnessNode = prominences.mul(0.035).add(0.055)
    this.clearcoat = 0.86
    this.clearcoatRoughness = 0.04
    this.normalNode = liquidNormal(near.mul(0.75).add(0.25), 0.09)
    this.emissiveNode = color(hsl.integer(36, 100, 61.1)).mul(prominences).mul(0.8).add(color(hsl.integer(85, 100, 86)).mul(corona).mul(near.mul(1.1).add(0.32))).add(color(hsl.integer(91, 100, 96.3)).mul(filaments).mul(1.45)).add(color(hsl.integer(74, 100, 79.2)).mul(rim).mul(sunGlint.mul(0.9).add(0.12)))
  }
}
