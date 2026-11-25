import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.88)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const boundary = cellularBoundary(p.mul(6.8))
    const deepBoundary = cellularBoundary(p.sub(view.mul(0.16)).mul(6.8).add(vec3(0.31, -0.17, 0.22)))
    const wire = hairline(boundary.sub(0.012), 0.012)
    const deepWire = hairline(deepBoundary.sub(0.014), 0.014)
    const climate = mx_noise_float(p.mul(2.7).add(vec3(time.mul(0.012), 0, 0)))
    let membrane = mix(color(hsl.integer(242, 74, 20)), color(hsl.integer(202, 43, 80)), climate.mul(0.5).add(0.5))
    membrane = mix(membrane, color(hsl.integer(322, 46, 64)), facing.mul(0.16))
    membrane = mix(membrane, color(hsl.integer(168, 47, 93)), grazing.mul(0.18))
    const edgeColor = mix(color(hsl.integer(204, 72, 80)), color(hsl.integer(300, 100, 74)), climate.mul(0.5).add(0.5))
    const vein = wire.add(deepWire.mul(0.18))
    const normal = proceduralNormal(vein, 0.0035)
    this.colorNode = membrane.add(edgeColor.mul(vein).mul(0.35))
    this.metalness = 0.04
    this.roughnessNode = float(0.05).add(vein.mul(0.07))
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.transmission = 0.38
    this.ior = 1.39
    this.dispersion = 0.1
    this.thickness = 0.12
    this.attenuationColor.set(hsl.integer(211, 53, 65))
    this.attenuationDistance = 0.9
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescence = 0.72
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = facing.mul(220).add(climate.mul(60)).add(155)
    const edgeFlash = glints(normalViewGeometry, 128)
    this.emissiveNode = edgeColor.mul(vein).mul(edgeFlash).mul(near.mul(0.22).add(0.035))
      .add(color(hsl.integer(299, 100, 84)).mul(grazing.pow(3)).mul(0.05))
  }
}
