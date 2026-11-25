import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.84)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
// Two virtual singers hover just outside the sculpture; moving around the gallery retunes their interference.
    const sourceA = vec3(view.x.mul(0.16), view.y.mul(0.13), 0.16)
    const sourceB = vec3(view.x.mul(-0.22).add(0.08), view.y.mul(-0.17).sub(0.06), -0.12)
    const radiusA = p.sub(sourceA).length()
    const radiusB = p.sub(sourceB).length()
    const phase = radiusA.mul(36).sub(radiusB.mul(43)).add(p.y.mul(5.2)).add(view.z.mul(2.6)).add(time.mul(0.22))
    const resolvedRidge = opticalBands(phase).pow(5)
    const secondPhase = p.x.mul(17).add(p.z.mul(23)).sub(view.x.mul(1.4)).add(time.mul(-0.16))
    const secondary = opticalBands(secondPhase).pow(8).mul(0.32)
    const dune = resolvedRidge.add(secondary).mul(near.mul(0.25).add(0.75))
    const grainNoise = mx_noise_float(p.mul(190).add(vec3(time.mul(0.02), 0, 0)))
    const grain = grainNoise.mul(0.5).add(0.5)
    const sparseGrains = cellularPoints(p.mul(105), 0.035, 0.14, 0.76).mul(near)
    const height = dune.mul(0.016).add(grain.mul(near).mul(0.0014)).add(sparseGrains.mul(0.002))
    const normal = proceduralNormal(height, 0.011)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.colorNode = mix(color(hsl.integer(52, 68, 27)), color(hsl.integer(82, 73, 77.5)), dune.mul(0.8).add(grain.mul(0.13)))
      .add(color(hsl.integer(96, 100, 94.5)).mul(sparseGrains).mul(0.28))
    this.metalness = 0.2
    this.roughnessNode = float(0.48).sub(dune.mul(0.12)).add(grain.mul(near).mul(0.06))
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.25
    this.sheen = 0.35
    this.sheenRoughness = 0.5
    const grainFlash = glints(normal, 170).mul(sparseGrains).mul(near)
    this.emissiveNode = color(hsl.integer(99, 100, 94.1)).mul(grainFlash).mul(0.8)
      .add(color(hsl.integer(86, 82, 84.7)).mul(dune).mul(facing.mul(0.12).add(grazing.mul(0.08))).mul(0.075))
  }
}
