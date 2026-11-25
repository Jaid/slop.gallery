import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec3, vec4} from 'three/tsl'

import {hash1} from '../../candidates/glm/lib/hash1.ts'
import {hash3} from '../../candidates/glm/lib/hash3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const grazing = normalViewGeometry.dot(positionViewDirection).abs().clamp().oneMinus()
    const rim = grazing.pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const cell = p.mul(6.5)
    const lattice = cell.floor()
    const scaleDistance = mx_worley_noise_float(cell)
    const dome = scaleDistance.smoothstep(0.12, 0.52).oneMinus()
    const seam = scaleDistance.smoothstep(0.4, 0.62)
    const scaleRand = hash1(lattice)
    const scaleDir = hash3(lattice.add(vec3(11.5, 7.2, 3.8))).add(vec3(0.02, 0.01, 0.015)).normalize()
    const flash = view.dot(scaleDir).clamp().pow(9)
    const hue = scaleRand.mul(0.22).add(view.x.mul(0.5)).add(view.y.mul(0.3)).add(p.y.mul(0.35)).add(0.55)
    const structural = spectralColor(hue)
    this.colorNode = mix(color(hsl.integer(251, 43, 5)), structural.mul(0.95), dome.mul(0.85))
    this.metalness = 0.78
    this.roughnessNode = dome.oneMinus().mul(0.24).add(0.1)
    this.iridescence = 1
    this.iridescenceIOR = 1.42
    this.iridescenceNode = dome.mul(0.65).add(0.3)
    this.iridescenceThicknessNode = scaleRand.mul(0.5).add(0.5).mul(400).add(240)
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.08
    this.envMapIntensity = 1.1
    this.normalNode = proceduralNormal(dome.add(mx_noise_float(p.mul(72)).mul(dome).mul(0.25)), 0.0021)
    this.emissiveNode = structural.mul(dome.pow(2)).mul(near.mul(0.4).add(0.12))
      .add(color(hsl.integer(229, 100, 92.3)).mul(flash).mul(dome).mul(0.55))
      .add(structural.mul(seam).mul(intimate).mul(0.5))
      .add(color(hsl.integer(211, 99, 84)).mul(rim).mul(0.28))
  }
}
