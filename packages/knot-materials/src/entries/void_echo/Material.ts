import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, negateOnBackSide, normalLocal, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, transformNormalToView, vec4} from 'three/tsl'

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
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const inner = p.sub(view.mul(0.17))
    const accretion = opticalLine(inner.xz.length().sub(time.mul(0.2)).mul(12).sin(), 0.05)
    const echo = mix(color(hsl.integer(0, 0, 0)), color(hsl.integer(301, 92, 46)), rim.pow(2))
    this.colorNode = color(hsl.integer(0, 0, 0))
    this.metalness = 0
    this.roughness = 1
    this.clearcoat = 1
    this.clearcoatRoughness = 0
    const lensNormal = normalLocal.add(view.cross(normalLocal).mul(rim.pow(2).mul(0.5)))
    this.normalNode = negateOnBackSide(transformNormalToView(lensNormal.normalize()))
    this.emissiveNode = color(hsl.integer(328.4, 100, 65.3)).mul(accretion).mul(near).add(echo.mul(2))
  }
}
