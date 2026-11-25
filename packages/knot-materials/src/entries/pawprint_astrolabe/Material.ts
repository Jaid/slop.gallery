import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const segmentDistance = Fn(([point, start, end]: [Node<'vec2'>, Node<'vec2'>, Node<'vec2'>]) => {
  const fromStart = point.sub(start)
  const segment = end.sub(start)
  const along = fromStart.dot(segment).div(segment.dot(segment).max(0.00001)).clamp()
  return fromStart.sub(segment.mul(along)).length()
})
/** A cat assembled entirely from beads and constellation-like connecting filaments. */
function catGlyph(grid: Node<'vec2'>) {
  const cell = grid.floor()
  const random = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), 7.31))
  const local = grid.fract().sub(0.5)
  const angle = random.x.sub(0.5).mul(0.34)
  const rotated = vec2(local.x.mul(angle.cos()).sub(local.y.mul(angle.sin())), local.x.mul(angle.sin()).add(local.y.mul(angle.cos())))
  const mirror = random.y.smoothstep(0.43, 0.57).mul(-2).add(1)
  const point = vec2(rotated.x.mul(mirror), rotated.y)
  let lines: Node<'float'> = float(0)
  let beads: Node<'float'> = float(0)
  const addLine = (start: Node<'vec2'>, end: Node<'vec2'>, width = 0.009) => {
    const distance = segmentDistance(point, start, end)
    const line = hairline(distance.sub(width), width)
    lines = lines.max(line)
  }
  const addBead = (center: Node<'vec2'>, radius = 0.022) => {
    const distance = point.sub(center).length()
    const footprint = distance.fwidth().max(0.002)
    const bead = distance.smoothstep(radius, float(radius).add(footprint)).oneMinus()
    beads = beads.max(bead)
    return bead
  }
// The head is a pearl ellipse with two unmistakable pointed ears.
  const head = vec2(point.x, point.y.sub(0.11)).div(vec2(0.115, 0.085)).length().sub(1).mul(0.085)
  lines = lines.max(hairline(head, 0.009))
  addLine(vec2(-0.083, 0.154), vec2(-0.125, 0.235))
  addLine(vec2(-0.125, 0.235), vec2(-0.012, 0.185))
  addLine(vec2(0.012, 0.185), vec2(0.075, 0.157))
  addLine(vec2(0.075, 0.157), vec2(0.125, 0.235))
  addLine(vec2(0.125, 0.235), vec2(0.085, 0.153))
// A small body, four paws and a questioning tail turn the glyph unmistakably feline.
  addLine(vec2(-0.067, 0.05), vec2(-0.095, -0.12), 0.012)
  addLine(vec2(-0.095, -0.12), vec2(-0.065, -0.205), 0.012)
  addLine(vec2(-0.065, -0.205), vec2(0.062, -0.205), 0.012)
  addLine(vec2(0.062, -0.205), vec2(0.094, -0.112), 0.012)
  addLine(vec2(0.094, -0.112), vec2(0.065, 0.052), 0.012)
  addLine(vec2(-0.047, -0.105), vec2(-0.115, -0.205), 0.011)
  addLine(vec2(0.045, -0.105), vec2(0.112, -0.205), 0.011)
  addLine(vec2(0.065, -0.02), vec2(0.185, -0.035), 0.011)
  addLine(vec2(0.185, -0.035), vec2(0.218, 0.095), 0.011)
  addLine(vec2(0.218, 0.095), vec2(0.158, 0.164), 0.011)
  addLine(vec2(0.04, 0.105), vec2(0.155, 0.075), 0.0045)
  addLine(vec2(0.035, 0.088), vec2(0.16, 0.057), 0.0045)
  addBead(vec2(-0.124, 0.238), 0.025)
  addBead(vec2(0.124, 0.238), 0.025)
  addBead(vec2(-0.032, 0.125), 0.011)
  addBead(vec2(0.032, 0.125), 0.011)
  addBead(vec2(0, 0.087), 0.01)
  addBead(vec2(-0.116, -0.209), 0.027)
  addBead(vec2(0.113, -0.209), 0.027)
  addBead(vec2(0.16, 0.164), 0.024)
// Three stray stars complete a tiny private constellation around every sleeper.
  const satellites: Node<'float'> = addBead(vec2(-0.235, 0.292), 0.014).max(addBead(vec2(0.272, 0.273), 0.014)).max(addBead(vec2(-0.228, -0.305), 0.014))
  let satelliteLines: Node<'float'> = float(0)
  const connect = (start: Node<'vec2'>, end: Node<'vec2'>) => {
    satelliteLines = satelliteLines.max(hairline(segmentDistance(point, start, end).sub(0.0045), 0.0045))
  }
  connect(vec2(-0.235, 0.292), vec2(-0.125, 0.235))
  connect(vec2(0.272, 0.273), vec2(0.218, 0.095))
  connect(vec2(-0.228, -0.305), vec2(-0.115, -0.205))
  return {
    beads,
    lines,
    random,
    satelliteLines,
    satellites,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {view, facing, near, intimate} = viewerFrame()
    const tube = uv()
    const row = tube.y.mul(4)
    const grid = vec2(tube.x.mul(10).add(row.fract().mul(0.5)), row)
    const glyph = catGlyph(grid)
    const echo = catGlyph(grid.add(vec2(view.x.mul(0.026), view.y.mul(0.017))))
    const cold = mix(color(hsl.integer(213, 100, 85)), color(hsl.integer(299, 100, 68)), glyph.random.y)
    const warm = mix(cold, color(hsl.integer(95, 100, 94.6)), glyph.random.x.smoothstep(0.67, 0.94))
    const height = glyph.lines.mul(0.32).add(glyph.beads).add(echo.lines.mul(0.06))
    const normal = proceduralNormal(height, 0.0075)
    const satelliteVisibility = intimate.mul(glyph.random.z.smoothstep(0.18, 0.78))
    const sparkle = glints(normal, 95)
    this.colorNode = color(hsl.integer(272, 50, 3))
    this.metalness = 0.28
    this.roughnessNode = float(0.14).add(near.mul(0.12))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.iridescence = 0.18
    this.iridescenceThicknessNode = facing.mul(85).add(125)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.emissiveNode = warm.mul(glyph.beads.mul(3.4).add(glyph.lines.mul(0.8)))
      .add(color(hsl.integer(252, 100, 92)).mul(glyph.beads).mul(sparkle).mul(1.2))
      .add(echo.beads.mul(echo.lines.mul(0.2).add(0.3)).mul(warm).mul(0.18))
      .add(warm.mul(glyph.satellites.mul(2.1).add(glyph.satelliteLines.mul(0.42))).mul(satelliteVisibility))
      .add(color(hsl.integer(295, 100, 58.7)).mul(facing.oneMinus().pow(4)).mul(0.045))
  }
}
