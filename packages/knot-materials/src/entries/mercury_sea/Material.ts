import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, normalLocal, time} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.38)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const phaseA = p.x.mul(8.5).add(p.y.mul(3.2)).sub(p.z.mul(5.4)).add(view.x.mul(1.35)).add(time.mul(0.62))
    const phaseB = p.z.mul(13.2).add(p.x.mul(2.1)).sub(p.y.mul(6.7)).sub(view.y.mul(0.85)).sub(time.mul(0.48))
    const phaseC = p.y.mul(19).add(p.z.mul(4.2)).add(p.x.mul(7.4)).add(view.z.mul(1.1)).add(time.mul(0.31))
    const wave = phaseA.sin().mul(0.43).add(phaseB.sin().mul(0.25)).add(phaseC.sin().mul(0.13))
    const height = wave.mul(near.mul(0.4).add(0.6))
    const normal = proceduralNormal(height, 0.0065)
    this.positionNode = p.add(normalLocal.mul(height.mul(0.0045)))
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.colorNode = color(hsl.integer(246, 14, 75))
    this.metalness = 1
    this.roughnessNode = float(0.018).add(near.mul(0.009))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.012
    this.iridescence = 0.08
    this.iridescenceIOR = 1.46
    this.iridescenceThicknessNode = facing.mul(95).add(180)
    const flash = glints(normal, 165)
    this.emissiveNode = color(hsl.integer(275, 100, 97)).mul(flash).mul(grazing.pow(2)).mul(0.018)
      .add(color(hsl.integer(246, 39, 53)).mul(wave.abs().mul(0.008)))
  }
}
