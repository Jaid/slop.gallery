import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const segmentDistance = Fn(([point, start, end]: [Node<'vec2'>, Node<'vec2'>, Node<'vec2'>]) => {
  const fromStart = point.sub(start)
  const segment = end.sub(start)
  const along = fromStart.dot(segment).div(segment.dot(segment).max(0.00001)).clamp()
  return fromStart.sub(segment.mul(along)).length()
})
function snowflake(grid: Node<'vec2'>, seed: number) {
  const cell = grid.floor()
  const random = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), seed))
  const scale = random.z.mul(0.28).add(0.82)
  const point = grid.fract().sub(0.5).div(scale)
  const turn = random.x.mul(TAU).add(time.mul(0.009))
  const rotated = vec2(point.x.mul(turn.cos()).sub(point.y.mul(turn.sin())), point.x.mul(turn.sin()).add(point.y.mul(turn.cos())))
  let distance: Node<'float'> = float(1)
  for (let arm = 0;arm < 6;arm++) {
    const angle = arm * Math.PI / 3
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const radial = vec2(rotated.x.mul(c).sub(rotated.y.mul(s)), rotated.x.mul(s).add(rotated.y.mul(c)))
    let branch = segmentDistance(radial, vec2(0, 0.025), vec2(0, 0.315))
    const y = 0.14
    const reach = 0.075
    branch = branch.min(segmentDistance(radial, vec2(0, y), vec2(-reach, y + 0.06)))
    branch = branch.min(segmentDistance(radial, vec2(0, y), vec2(reach, y + 0.06)))
    distance = distance.min(branch)
  }
  const crystal = hairline(distance.sub(0.008), 0.008)
  const orbit = hairline(rotated.length().sub(0.355), 0.0035)
  const core = rotated.length().sub(0.025)
  return {
    crystal: crystal.max(core.smoothstep(0, 0.022).oneMinus().mul(0.85)),
    orbit,
    random,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.86)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const row = tube.y.mul(4)
    const grid = vec2(tube.x.mul(10).add(row.fract().mul(0.5)), row)
    const snow = snowflake(grid, 2.8)
    const echo = snowflake(grid.add(vec2(0.03, -0.02)), 2.8)
    const frost = snow.crystal.add(snow.orbit.mul(0.28)).add(echo.crystal.mul(0.1))
    const nuclei = cellularPoints(p.mul(74), 0.025, 0.12, 0.78).mul(intimate)
    const normal = proceduralNormal(frost.add(nuclei.mul(0.2)), 0.0085)
    this.colorNode = mix(color(hsl.integer(249, 60, 8)), color(hsl.integer(221, 100, 90)), frost).add(color(hsl.integer(197, 100, 98.6)).mul(nuclei).mul(0.3))
    this.metalness = 0.12
    this.roughnessNode = float(0.06)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.clearcoat = 1
    this.iridescence = 0.25
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = facing.mul(120).add(175)
    this.emissiveNode = color(hsl.integer(221, 100, 90)).mul(frost).mul(facing.mul(0.08).add(grazing.mul(0.04))).mul(near.mul(0.2).add(0.05))
  }
}
