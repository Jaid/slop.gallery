import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

function cloisonne(grid: Node<'vec2'>, seed: number) {
  const cell = grid.floor()
  const local = grid.fract().sub(0.5)
  let boundary: Node<'float'> = float(10)
  for (const [x, y] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
    const neighbor = wrapCell(cell.add(vec2(x, y)), vec2(10, 9))
    const identity = cellNoiseVec3(vec3(neighbor.x.add(0.5), neighbor.y.add(0.5), seed))
    const center = identity.xy.sub(0.5).mul(0.7)
    const distance = local.sub(vec2(x, y).sub(center)).length()
    boundary = boundary.min(distance)
  }
  const identity = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), seed))
  const center = identity.xy.sub(0.5).mul(0.7)
  const bead = local.sub(center).length()
  return {
    boundary,
    identity,
    bead,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.92)
    this.name = knotData.id
    const {grazing, near} = viewerFrame()
    const tube = uv()
    const grid = vec2(tube.x.mul(10).add(tube.y.mul(TAU).sin().mul(0.24)), tube.y.mul(9).add(tube.x.mul(TAU).sin().mul(0.11)))
    const cell = cloisonne(grid, 4.17)
    const boundary = cell.boundary
    const wire = opticalLine(boundary, 0.014)
    const wireHalo = boundary.smoothstep(0.006, 0.075).oneMinus()
    const enamelDot = cell.bead.smoothstep(0.018, 0.072).oneMinus().mul(cell.identity.z.smoothstep(0.72, 0.95))
    const night = mix(color(hsl.integer(261, 77, 19)), color(hsl.integer(217, 92, 32)), cell.identity.y)
    const ember = mix(color(hsl.integer(357, 63, 21)), color(hsl.integer(64, 73, 56)), cell.identity.z)
    const ivory = color(hsl.integer(86, 30, 79))
    let enamel = mix(night, ember, cell.identity.x.smoothstep(0.55, 0.8))
    enamel = mix(enamel, ivory, cell.identity.x.smoothstep(0.91, 0.99).mul(0.62))
    enamel = enamel.mul(0.82).add(color(hsl.integer(259, 38, 7.5)).mul(0.22))
    const gold = mix(color(hsl.integer(62, 84, 46)), color(hsl.integer(89, 100, 91)), cell.identity.z.smoothstep(0.45, 0.95))
    const height = wire.mul(0.8).add(enamelDot.mul(0.18)).add(wireHalo.mul(0.06))
    const normal = proceduralNormal(height, 0.009)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.colorNode = mix(enamel, gold, wire).add(gold.mul(enamelDot).mul(0.25))
    this.metalnessNode = float(0.06).add(wire.mul(0.9))
    this.roughnessNode = mix(float(0.105), float(0.19), wire).add(enamelDot.mul(0.11))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    const eyeLight = glints(normal, 125)
    this.emissiveNode = gold.mul(wire).mul(eyeLight).mul(near.mul(0.18).add(0.07))
      .add(color(hsl.integer(81, 78, 85)).mul(enamelDot).mul(eyeLight).mul(0.08))
      .add(color(hsl.integer(209, 49, 82)).mul(wireHalo).mul(grazing.pow(3)).mul(0.07))
  }
}
