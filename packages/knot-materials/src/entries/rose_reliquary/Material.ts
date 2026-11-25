import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_noise_float, struct, time, uv, vec2, vec3} from 'three/tsl'

import {rgb} from '../../candidates/muse_wonder/lib/rgb.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const offsets = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(y => [x, y] as const))
const PeriodicVoronoiResult = struct({
  cell: 'vec2',
  border: 'float',
  distance: 'float',
}, 'PeriodicVoronoiResult')
type Member = <Type extends 'float' | 'vec2'>(name: string) => Node<Type>
const periodicVoronoiCore = Fn(([position, period]: [Node<'vec2'>, Node<'vec2'>]) => {
  const base = position.floor().toVar()
  const nearestCell = vec2(0).toVar()
  const nearestDistance = float(1e9).toVar()
  const secondDistance = float(1e9).toVar()
  for (const offset of offsets) {
    const cellOffset = vec2(...offset)
    const cell = base.add(cellOffset)
    const wrapped = wrapCell(cell, period)
    const point = cellNoiseVec3(vec3(wrapped, 19.7)).xy.mul(0.76).add(0.12)
    const distance = cell.add(point).sub(position).length()
    const closer = distance.lessThan(nearestDistance)
    secondDistance.assign(closer.select(nearestDistance, distance.min(secondDistance)))
    nearestCell.assign(closer.select(wrapped, nearestCell))
    nearestDistance.assign(closer.select(distance, nearestDistance))
  }
  return PeriodicVoronoiResult(nearestCell, secondDistance.sub(nearestDistance), nearestDistance)
})
/** Seamless 2D Voronoi on a periodic tube domain: wrapped cell identity, F1 distance and the F2−F1 border field. */
function periodicVoronoi(position: Node<'vec2'>, period: Node<'vec2'>) {
  const result = (periodicVoronoiCore(position, period) as unknown as {toVar: () => {get: Member}}).toVar()
  return {
    cell: result.get<'vec2'>('cell'),
    border: result.get<'float'>('border'),
    distance: result.get<'float'>('distance'),
  }
}

/** A rose window bent until it meets itself. Hand-cut jewel panes, none of them quite the same color twice, are held in dark lead came over a light that never stops circling inside the glass. Face a pane and it burns; turn away and it falls back to colored stone, leaving only the leadwork to catch the room. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, objectDistance} = viewerFrame()
    const close = objectDistance.smoothstep(1.5, 4.8).oneMinus()
    const intimate = objectDistance.smoothstep(1.15, 3.1).oneMinus()
    const panes = periodicVoronoi(tube.mul(vec2(24, 4)), vec2(24, 4))
    const identity = cellNoiseVec3(vec3(panes.cell, 7.7))
    const hand = cellNoiseVec3(vec3(panes.cell, 93.1))
// Jewel glass chosen pane by pane, then clouded by the hand that blew it.
    let jewel = rgb(hsl.integer(18, 91, 37))
    jewel = mix(jewel, rgb(hsl.integer(68, 94, 65)), identity.x.smoothstep(0.16, 0.2))
    jewel = mix(jewel, rgb(hsl.integer(154, 98.2, 49)), identity.x.smoothstep(0.34, 0.38))
    jewel = mix(jewel, rgb(hsl.integer(208, 93, 47)), identity.x.smoothstep(0.5, 0.54))
    jewel = mix(jewel, rgb(hsl.integer(263, 90, 41)), identity.x.smoothstep(0.66, 0.7))
    jewel = mix(jewel, rgb(hsl.integer(301, 83, 37.5)), identity.x.smoothstep(0.83, 0.87))
    const cloud = mx_noise_float(p.mul(31).add(identity.mul(7))).mul(0.5).add(0.5)
    const seeded = mx_noise_float(p.mul(83).add(hand.mul(11))).mul(0.5).add(0.5)
    jewel = jewel.mul(cloud.mul(0.26).add(seeded.mul(0.12)).add(0.78).add(identity.y.mul(0.28)))
    const leadField = panes.border
    const leadAa = leadField.fwidth().max(0.0001)
    const lead = leadField.smoothstep(leadAa.mul(0.5), leadAa.mul(2).add(0.085)).oneMinus()
    const came = leadField.smoothstep(0.18, 0.36).oneMinus()
    const leadRelief = leadField.smoothstep(0.015, 0.11).oneMinus()
    const relief = leadRelief.mul(0.0017).sub(came.mul(0.00045)).add(panes.distance.mul(-0.00022))
    const glassNormal = proceduralNormal(relief, 1)
    this.normalNode = glassNormal
    this.clearcoatNormalNode = glassNormal
    const leadColor = color(hsl.integer(285, 19, 8))
    this.colorNode = mix(jewel.mul(0.42), leadColor, lead)
    this.metalnessNode = lead.mul(0.86)
    this.roughnessNode = mix(float(0.14), float(0.38), lead).add(cloud.mul(0.035))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = mix(float(0.045), float(0.22), lead)
    this.iridescenceNode = grazing.mul(lead.oneMinus()).mul(0.18)
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = facing.mul(190).add(identity.z.mul(90)).add(110)
    this.aoNode = came.mul(-0.18).add(1)
// The imprisoned sun circles slowly, pane by pane; each pane answers at a different hour.
    const sun = tube.x.mul(TAU * 2).sub(time.mul(0.09)).add(identity.z.mul(TAU)).sin().mul(0.5).add(0.5)
    const innerLight = sun.pow(2).mul(0.85).add(0.3)
    const bubbles = cellularPoints(p.mul(54), 0.016, 0.12, 0.66).mul(intimate).mul(lead.oneMinus())
    const paneGlow = jewel.mul(innerLight).mul(facing.mul(0.78).add(0.3)).mul(grazing.oneMinus().mul(0.45).add(0.55)).mul(near.mul(0.55).add(0.78)).mul(lead.oneMinus())
    this.emissiveNode = paneGlow.mul(1.3)
      .add(color(hsl.integer(93, 100, 97)).mul(bubbles).mul(0.9))
      .add(color(hsl.integer(276, 100, 94)).mul(lead).mul(glints(glassNormal, 210)).mul(close.mul(0.9).add(0.4)).mul(1.6))
      .add(jewel.mul(lead.oneMinus()).mul(grazing.pow(3)).mul(0.08))
  }
}
