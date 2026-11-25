import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, max, mix, sin, uv} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, intimate} = viewerFrame()
    const tube = uv()
    const warp = sin(tube.x.mul(300)).abs().pow(10)
    const weft = sin(tube.y.mul(300)).abs().pow(10)
    const weave = max(warp, weft)
    const stars = cellularPoints(p.mul(50), 0.035, 0.2)
    const threadColor = mix(color(hsl.integer(283, 37, 13)), color(hsl.integer(16, 86, 57.3)), stars)
    this.colorNode = color(hsl.integer(284, 27, 4))
    this.metalness = 0.1
    this.roughness = 0.8
    this.sheen = 1
    this.sheenRoughnessNode = weave.mul(0.2).add(0.1)
    this.sheenNode = threadColor
    this.anisotropyNode = weave
    this.emissiveNode = threadColor.mul(weave).mul(3).mul(intimate.mul(0.6).add(0.4)).add(color(hsl.integer(0, 0, 100)).mul(stars).mul(5))
    this.normalNode = proceduralNormal(weave, 0.01)
  }
}
