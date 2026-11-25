import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, cos, max, mix, sin, time} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, intimate} = viewerFrame()
    const t = time.mul(0.3)
    const q = p.mul(4)
    const rotX = q.x.mul(cos(t)).sub(q.y.mul(sin(t)))
    const rotY = q.x.mul(sin(t)).add(q.y.mul(cos(t)))
    const rotZ = q.z.mul(cos(t.mul(0.7))).sub(q.x.mul(sin(t.mul(0.7))))
    const gridX = sin(rotX.mul(Math.PI * 2)).abs().pow(20)
    const gridY = sin(rotY.mul(Math.PI * 2)).abs().pow(20)
    const gridZ = sin(rotZ.mul(Math.PI * 2)).abs().pow(20)
    const grid = max(gridX, max(gridY, gridZ))
    const intersection = gridX.mul(gridY).mul(gridZ).pow(0.33)
    const gridColor = mix(color(hsl.integer(171, 100, 87)), color(hsl.integer(328.4, 100, 65.3)), intersection)
    this.colorNode = color(hsl.integer(0, 0, 5.5))
    this.metalness = 0.2
    this.roughness = 0.9
    this.emissiveNode = gridColor.mul(grid).mul(4).mul(intimate.mul(0.5).add(0.5)).add(color(hsl.integer(0, 0, 100)).mul(intersection).mul(10))
    this.normalNode = proceduralNormal(grid, 0.008)
    this.clearcoat = 0.5
    this.clearcoatRoughness = 0.3
  }
}
