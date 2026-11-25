import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec3, vec4} from 'three/tsl'

import {fbm} from '../../candidates/glm/lib/fbm.ts'
import {hash1} from '../../candidates/glm/lib/hash1.ts'
import {starGlints} from '../../candidates/glm/lib/starGlints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
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
    const speckle = fbm(p.mul(9), 2)
    const matrix = fbm(p.mul(2.3), 4)
    const widman = opticalLine(matrix.sub(0.1), 0.07).mul(0.6)
    const glint = starGlints(p.mul(110), view)
    const rare = starGlints(p.mul(36).add(vec3(7.7, 4.1, 2.3)), view, 30)
    const glintColor = mix(color(hsl.integer(257, 100, 95)), color(hsl.integer(77, 100, 92)), hash1(p.mul(110).add(vec3(3.3, 8.8, 1.1))).mul(0.5).add(0.5))
    const inner = p.sub(view.mul(0.24))
    const nebula = fbm(inner.mul(3.6)).add(inner.y.mul(0.7))
    const nebulaMask = nebula.smoothstep(0.5, 1.15)
    const nebulaColor = mix(color(hsl.integer(286, 99, 53)), color(hsl.integer(345, 100, 75.4)), view.x.mul(0.5).add(0.5))
    this.colorNode = mix(color(hsl.integer(302, 20, 10)), color(hsl.integer(304, 19, 18)), speckle.mul(0.5).add(0.5)).add(color(hsl.integer(300, 29, 31)).mul(widman))
    this.metalnessNode = glint.mul(0.4).add(0.5)
    this.roughnessNode = speckle.mul(0.5).add(0.5).mul(0.17).add(0.35)
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.22
    this.transmission = 0.3
    this.thickness = 0.7
    this.ior = 1.52
    this.dispersion = 0.22
    this.attenuationColor.set(hsl.integer(296, 51, 14.4))
    this.attenuationDistance = 0.9
    this.envMapIntensity = 1.15
    this.normalNode = proceduralNormal(speckle, 0.0009)
    this.emissiveNode = glintColor.mul(glint).mul(near.mul(0.9).add(0.55)).mul(1.7)
      .add(color(hsl.integer(261, 100, 90)).mul(rare).mul(1.5))
      .add(nebulaColor.mul(nebulaMask).mul(intimate).mul(0.55))
      .add(color(hsl.integer(267, 60, 74)).mul(rim).mul(0.12))
  }
}
