import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_rotate2d, time, uv} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const {view, near, intimate} = viewerFrame()
    const angle = view.x.mul(0.8).add(view.y.mul(0.6)).add(time.mul(0.12))
    const rot = (mx_rotate2d(tube.sub(0.5), angle) as unknown as Node<'vec2'>).add(0.5)
    const rot2 = (mx_rotate2d(rot.sub(0.5), angle.mul(1.618)) as unknown as Node<'vec2'>).add(0.5)
    const gridA = opticalLine(rot.x.mul(22).fract().sub(0.5), 0.035)
    const gridB = opticalLine(rot.y.mul(22).fract().sub(0.5), 0.035)
    const grid = gridA.max(gridB)
    const depthGrid = opticalLine(rot2.x.mul(14).add(rot2.y.mul(14)).fract().sub(0.5), 0.045).mul(intimate)
    const wire = grid.max(depthGrid.mul(0.65))
    const chroma = spectralColor(rot.x.mul(5).add(rot.y.mul(4)).add(time.mul(0.25)))
    this.colorNode = color(hsl.integer(281, 53, 3))
    this.transmission = 0.88
    this.thickness = 0.55
    this.ior = 1.42
    this.roughness = 0.02
    this.metalness = 0
    this.iridescence = 1
    this.iridescenceThicknessNode = wire.mul(320).add(140)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = proceduralNormal(wire.mul(0.35), 0.0008)
    this.emissiveNode = chroma.mul(wire).mul(1.9).mul(near.mul(0.7).add(0.5)).add(color(hsl.integer(0, 0, 100)).mul(wire.pow(3)).mul(0.35))
  }
}
