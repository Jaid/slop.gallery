import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // World-unit camera distance, not screen UVs or changing texture scale.
    // Fine/deep layers fade in continuously on approach; their positions stay fixed.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const deep = p.sub(view.mul(0.28))
    // True play-of-color: the fire phase mixes cell noise with view direction
    // and facing, so every step around the pedestal re-deals the spectrum.
    const cells = mx_noise_float(inner.mul(8).add(mx_noise_vec3(inner.mul(3)).mul(0.6))).mul(0.5).add(0.5)
    const patches = cells.smoothstep(0.4, 0.72)
    const fire = spectralColor(cells.mul(9).add(view.x.mul(5)).add(view.y.mul(4)).add(facing.mul(3)))
    const scales = opticalLine(mx_noise_float(p.mul(18)), 0.03)
    const deepFire = opticalLine(mx_noise_float(deep.mul(21)), 0.026).mul(near)
    this.colorNode = mix(color(hsl.integer(300, 52, 7)), color(hsl.integer(303, 58, 13)), patches)
    this.transmission = 0.6
    this.thickness = 0.4
    this.ior = 1.5
    this.dispersion = 0.5
    this.attenuationColor.set(hsl.integer(294, 67, 17))
    this.attenuationDistance = 0.6
    this.roughness = 0.07
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.04
    this.iridescence = 1
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = cells.mul(400).add(300)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(20)), 0.002)
    this.emissiveNode = fire.mul(patches).mul(scales.mul(0.7).add(0.35)).mul(near.mul(0.55).add(0.3)).add(color(hsl.integer(340, 100, 72.4)).mul(deepFire).mul(0.7))
  }
}
