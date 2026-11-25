import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {pixelFootprint} from '../../candidates/claude_opus/lib/footprint.ts'
import {knotArc, knotCircumference, knotLength} from '../../candidates/claude_opus/lib/knotArc.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameOpus55.ts'
import {tubeRelief} from '../../candidates/claude_opus/lib/tubeRelief.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** scale rows along the body (even, so the staggered rows close at the seam) and scales per row */
const rows = 160
const perRow = 14
const rowPitch = knotLength / rows
const scalePitch = knotCircumference / perRow
/** row spacing relative to the spacing around the tube */
const aspect = rowPitch / scalePitch
const radius = 0.74
/** The wyrm's slow breath: a swell that travels from head to tail. */
const breath = (arc: Node<'float'>) => arc.mul(TAU * 3).sub(time.mul(0.55)).sin().mul(0.5).add(0.5)
/** Overlapping scales, staggered like shingles: later rows lie on top of earlier ones. Returns the visible scale, its local coordinates and the gap to the free edge of the row lying over it. */
function scales(tube: Node<'vec2'>, lift: Node<'float'>) {
  const arc = knotArc(tube.x)
  const grid = vec2(arc.mul(rows), tube.y.mul(perRow))
  const base = grid.x.floor()
  const candidate = (offset: number) => {
    const row = base.add(offset)
    const shift = row.mod(2).mul(0.5)
    const column = grid.y.sub(shift).round()
    const local = vec2(grid.x.sub(row).mul(aspect), grid.y.sub(column.add(shift)))
    return {
      column,
      distance: local.length(),
      local,
      row,
    }
  }
  const top = candidate(2)
  const middle = candidate(1)
  const bottom = candidate(0)
  const coversTop = top.distance.step(radius).oneMinus()
  const coversMiddle = middle.distance.step(radius).oneMinus()
// pick the highest covering row, and remember the row lying over it
  const pick = (a: Node<'float'>, b: Node<'float'>, c: Node<'float'>) => mix(mix(c, b, coversMiddle), a, coversTop)
  const row = pick(top.row, middle.row, bottom.row)
  const column = pick(top.column, middle.column, bottom.column)
  const local = vec2(pick(top.local.x, middle.local.x, bottom.local.x), pick(top.local.y, middle.local.y, bottom.local.y))
  const distance = pick(top.distance, middle.distance, bottom.distance)
  const above = candidate(3)
  const overhang = mix(mix(middle.distance, top.distance, coversMiddle), above.distance, coversTop).sub(radius)
// bristling widens the shadowed gap beneath each overhanging edge
  const gap = overhang.div(lift.mul(0.22).add(0.05))
  return {
    arc,
    column: column.mod(perRow),
    distance,
    gap,
    local,
    row: row.mod(rows),
  }
}
/** A sleeping dragon. Staggered scales of blackened bronze, each domed and keeled, overlap along the knot like shingles. Between them glows the fire of its body, breathing in a slow wave from head to tail. As a visitor approaches, the wyrm stirs: its scales lift, the embers beneath flare, and an oil-dark iridescence slides over the plates with every step. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const {objectDistance, view, grazing} = viewerFrame()
    const stir = objectDistance.smoothstep(1, 3.2).oneMinus()
    const lift = stir.mul(0.8).add(0.2)
    const layout = scales(tube, lift)
    const inhale = breath(layout.arc)
    const identity = cellNoiseVec3(vec3(layout.row, layout.column, 2.3))
// relief: domed plates with a central keel, free edges raised and the gaps beneath them sunk
    const swell = (at: Node<'vec2'>) => breath(knotArc(at.x)).mul(0.004).mul(lift.mul(0.6).add(0.4))
    const height = (at: Node<'vec2'>) => {
      const s = scales(at, lift)
      const dome = s.distance.div(radius).pow(2).oneMinus().max(0).sqrt()
      const keel = s.local.y.div(0.09).pow(2).negate().exp().mul(s.local.x.negate().div(radius).clamp().oneMinus())
      const raise = s.local.x.negate().div(radius).clamp().mul(lift)
      const sink = s.gap.negate().exp().mul(-1)
// every plate sits at its own slight angle, so highlights break scale by scale
      const tilt = cellNoiseVec3(vec3(s.row, s.column, 7.7)).xy.sub(0.5).dot(s.local).mul(0.006)
      return dome.mul(0.0042).add(keel.mul(0.0012)).add(raise.mul(0.0045)).add(sink.mul(0.0035)).add(tilt).add(swell(at))
    }
    const rest = knotFrame(tube)
    this.positionNode = rest.position.add(rest.normal.mul(swell(tube)))
    const relief = tubeRelief(height)
    this.normalNode = relief.viewNormal
// fire in the gaps: white at the deepest point, cooling to orange and blood red
    const pixel = pixelFootprint().balanced
    const softness = pixel.div(scalePitch * 0.2).max(0.02)
    const ember = layout.gap.mul(3.4).negate().div(softness.add(1)).exp()
// hot pockets and cooler crusts drift along each crevice
    const flicker = mx_noise_float(vec3(layout.arc.mul(60), tube.y.mul(8), time.mul(1.3))).mul(0.25).add(0.85)
      .mul(mx_noise_float(vec3(layout.arc.mul(260), tube.y.mul(40), time.mul(0.35))).mul(0.6).add(0.75))
    const heat = ember.mul(inhale.mul(0.7).add(0.3)).mul(flicker).mul(stir.mul(1.4).add(0.45))
    const fire = mix(mix(color(hsl.integer(30, 97, 16)), color(hsl.integer(33.6, 100, 59.7)), heat.smoothstep(0.04, 0.5)), color(hsl.integer(81, 100, 84)), heat.smoothstep(0.7, 1.4)).mul(heat.mul(1.6))
// thin rims glow faintly where the fire shows through the plates
    const rim = layout.distance.sub(radius).negate().div(0.06).negate().exp().mul(layout.local.x.negate().smoothstep(0, radius))
    const glowThrough = color(hsl.integer(38.8, 100, 63)).mul(rim.mul(inhale.mul(0.5).add(0.2)).mul(stir.mul(0.4).add(0.08)))
// oil-dark iridescence: a thin film whose hue slides with the viewing angle
    const facing = relief.objectNormal.dot(view).abs()
    const film = spectralColor(facing.mul(4.2).add(identity.x.mul(2)).add(layout.local.x.mul(1.5)))
    const plate = mix(color(hsl.integer(58, 27, 9)), color(hsl.integer(65, 46, 15)), identity.y)
    const bronze = mix(color(hsl.integer(65, 60, 35)), color(hsl.integer(70, 59, 53)), identity.z)
    const edgeWear = layout.local.x.negate().div(radius).smoothstep(0.55, 1).mul(0.8)
// concentric growth lines, like the rings of a horn
    const growth = layout.distance.mul(46).add(identity.x.mul(TAU)).sin().mul(0.5).add(0.5).mul(pixel.div(scalePitch / 40).smoothstep(0.5, 1.2).oneMinus())
    this.colorNode = mix(mix(plate, bronze, edgeWear).mul(growth.mul(0.25).add(0.85)), film.mul(0.3), float(0.08).mul(edgeWear.oneMinus()))
    this.metalness = 0.85
    this.roughnessNode = mix(identity.x.mul(0.12).add(0.24), float(0.48), edgeWear).add(ember.mul(0.5)).add(mx_noise_float(rest.position.mul(180)).mul(0.05))
    this.emissiveNode = fire.mul(ember.step(0.02)).add(glowThrough).add(color(hsl.integer(47, 100, 68)).mul(grazing.pow(4)).mul(inhale).mul(0.04))
  }
}
