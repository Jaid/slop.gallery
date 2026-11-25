import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    // Object-space direction from the surface point to the camera. Drives every
    // angular reaction in this file (parallax, hue shift, fresnel tinting).
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance — fine/deep layers fade in continuously on approach,
    // their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    // Ribbons of charged particles coiled inside the glass. The palette is
    // indexed by the object-space view vector, so the aurora visibly swings
    // its greens and magentas as the visitor walks around the knot.
    const sheet = mx_noise_vec3(inner.mul(3.5)).mul(0.55)
    const wave = inner.y.mul(2.2).add(sheet.y.mul(1.6)).add(time.mul(0.18)).sin()
    const blade = opticalLine(wave, 0.14)
    const fringe = opticalLine(wave.mul(2.6).add(sheet.z.mul(2)).sin(), 0.07)
    const shimmer = mx_noise_float(p.mul(24).add(time.mul(0.4))).mul(0.5).add(0.5)
    const hue = inner.y.mul(0.55).add(view.x.mul(1.1)).add(view.y.mul(0.4)).add(time.mul(0.05))
    const palette = mix(mix(color(hsl.integer(234, 59, 8)), color(hsl.integer(168, 96, 79)), hue.sin().mul(0.5).add(0.5)), color(hsl.integer(306, 100, 57.4)), hue.add(2.1).cos().mul(0.5).add(0.5).pow(2))
    this.colorNode = mix(color(hsl.integer(234, 59, 5)), palette, blade.mul(grazing.mul(0.45).add(0.35)))
    this.transmission = 0.72
    this.thickness = 0.55
    this.ior = 1.42
    this.roughnessNode = blade.mul(0.04).add(0.055)
    this.clearcoat = 0.75
    this.clearcoatRoughness = 0.05
    this.iridescence = 0.6
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = wave.mul(140).add(340)
    this.emissiveNode = palette.mul(blade.mul(0.9).add(fringe.mul(0.55))).mul(shimmer).mul(near.mul(0.6).add(0.35)).add(color(hsl.integer(167, 100, 89.9)).mul(rim).mul(0.4))
  }
}
