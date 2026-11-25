import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
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
    const deep = p.sub(view.mul(0.28))
    const plasma = mx_noise_float(inner.mul(8).add(vec3(time.mul(0.2), 0, time.mul(-0.15))))
    const loops = opticalBands(plasma.mul(12)).pow(2)
    const flares = filament(mx_noise_float(deep.mul(15).sub(time.mul(0.3))), 0.03)
    const coreHeat = facing.pow(4).mul(2.5)
    this.colorNode = color(hsl.integer(0, 0, 0))
    this.emissiveNode = mix(color(hsl.integer(30.9, 100, 57.8)), color(hsl.integer(108, 100, 97.7)), loops.mul(flares.add(0.2))).mul(coreHeat.add(0.8)).add(color(hsl.integer(0, 0, 100)).mul(rim.pow(6)).mul(4))
    this.roughnessNode = loops.mul(0.4).add(0.3)
    this.normalNode = liquidNormal(near, 0.3)
  }
}
