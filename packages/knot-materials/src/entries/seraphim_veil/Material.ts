import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
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
    const inner = p.sub(view.mul(0.16))
    const deep = p.sub(view.mul(0.28))
    const abyss = p.sub(view.mul(0.42))
    // A nearly weightless pearl body containing thousands of luminous fibres.
    //
    // Multiple fibre families are oriented differently, so different strands
    // ignite as the viewer crosses particular reflection directions.
    const warp = mx_noise_float(inner.mul(5)).mul(2.1)
    const braidA = inner.dot(vec3(4, 17, -6)).mul(6.5).add(warp).add(time.mul(0.035))
    const braidB = deep.dot(vec3(-11, 5, 13)).mul(5.2).sub(warp.mul(0.8)).sub(time.mul(0.025))
    const fibresA = filament(braidA.sin(), 0.065)
    const fibresB = filament(braidB.sin(), 0.055).mul(near)
    const hair = filament(abyss.dot(vec3(19, -7, 23)).mul(7.5).add(mx_noise_float(abyss.mul(12)).mul(2.4)).sin(), 0.047).mul(intimate)
    const flashA = view.dot(vec3(0.24, 0.95, 0.19).normalize()).abs().pow(14)
    const flashB = view.dot(vec3(-0.78, 0.36, 0.51).normalize()).abs().pow(12)
    const pearlPhase = inner.y.mul(5).add(view.x.mul(6)).sub(view.z.mul(5))
    const pearl = spectralColor(pearlPhase)
    this.colorNode = mix(color(hsl.integer(81, 20, 84)), color(hsl.integer(84, 100, 96.6)), facing.mul(0.62).add(0.2)).add(pearl.mul(grazing).mul(0.035))
    this.transmission = 0.34
    this.thickness = 0.24
    this.ior = 1.39
    this.roughnessNode = near.mul(-0.06).add(0.29)
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(262, 100, 91)), color(hsl.integer(70, 100, 88.4)), flashA.mul(0.65).add(flashB.mul(0.35)).clamp())
    this.sheenRoughness = 0.31
    this.clearcoat = 0.38
    this.clearcoatRoughness = 0.11
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(46)).mul(near), 0.00022)
    this.emissiveNode = color(hsl.integer(84, 100, 92)).mul(fibresA).mul(flashA.mul(1.6).add(0.22)).add(color(hsl.integer(256, 100, 85)).mul(fibresB).mul(flashB.mul(1.4).add(0.28))).add(color(hsl.integer(85, 100, 98.4)).mul(hair).mul(1.2)).add(pearl.mul(rim).mul(0.075))
  }
}
