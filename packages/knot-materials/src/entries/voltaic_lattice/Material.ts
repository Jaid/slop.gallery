import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, normalViewGeometry, positionView, positionViewDirection, time, uv} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const t = uv()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    // A conductor cage: long rails along the tube, slow rings drifting around it.
    const rings = filament(t.y.mul(8).sub(time.mul(0.05)).fract().sub(0.5), 0.07)
    const rails = filament(t.x.mul(64).add(t.y.mul(3)).fract().sub(0.5), 0.07)
    const wire = rails.max(rings)
    const surge = t.x.mul(18.8).sub(time.mul(1.1)).sin().mul(0.5).add(0.5)
    const chroma = spectralColor(t.x.mul(2.2).add(time.mul(0.04)))
    this.colorNode = color(hsl.integer(273, 28, 4))
    this.metalness = 0.6
    this.roughnessNode = wire.mul(-0.2).add(0.32)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(wire.mul(0.5), 0.0012)
    this.emissiveNode = chroma.mul(wire).mul(surge.mul(1.8).add(0.5)).mul(near.mul(0.4).add(0.8)).add(color(hsl.integer(0, 0, 100)).mul(wire.pow(4)).mul(0.5)).add(color(hsl.integer(267, 100, 45)).mul(grazing.pow(3)).mul(0.25))
  }
}
