import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, negateOnBackSide, normalLocal, select, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_sonnet/lib/ramp.ts'
import {filteredRoughness} from '../../candidates/claude_sonnet/lib/specularFilter.ts'
import {knotFrame} from '../../candidates/claude_sonnet/lib/tubeBasis.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

// Hexagonal lattice of spikes: 228 columns along the tube, 30 rows around it. A cell is 0.0315 wide in object space,
// rows are spaced by sin(60°) of that, so every spike has six equidistant neighbors.
const columns = 228
const rows = 30
const cellWorld = 0.0315
const rowSpacing = Math.sqrt(3) / 2
/** Nearest spike of the staggered lattice: offset to its apex in cell widths, the distance and a wrapped identity. */
const nearestSpike = (tube: Node<'vec2'>) => {
  const q = vec2(tube.x.mul(columns), tube.y.mul(rows))
  const baseRow = q.y.floor()
  let best: Node<'float'> = float(64)
  let delta: Node<'vec2'> = vec2(0)
  let cell: Node<'vec2'> = vec2(0)
  for (let j = -1; j <= 1; j++) {
    const row = baseRow.add(j)
    const stagger = row.mod(2).mul(0.5)
    for (let i = -1; i <= 1; i++) {
      const column = q.x.sub(stagger).floor().add(i)
      const offset = vec2(q.x.sub(column).sub(stagger).sub(0.5), q.y.sub(row).sub(0.5).mul(rowSpacing))
      const distance = offset.dot(offset)
      const closer = distance.lessThan(best)
      best = select(closer, distance, best)
      delta = select(closer, offset, delta)
      cell = select(closer, wrapCell(vec2(column, row), vec2(columns, rows)), cell)
    }
  }
  return {
    q,
    delta,
    distance: best.sqrt(),
    cell,
  }
}

/** Liquid night: a ferrofluid pool whose spikes climb out of the surface as the viewer approaches. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {objectDistance, rim, facing} = viewerFrame()
    const tube = uv()
    const spike = nearestSpike(tube)
    const random = cellNoiseVec3(vec3(spike.cell, 3.7))
    // magnetic pull: distance raises the spikes, a slow wave travels along the knot and each spike breathes
    const pull = ramp(objectDistance, 3.7, 1.25)
    const carrier = tube.x.mul(TAU * 3).sub(time.mul(0.9)).sin().mul(0.5).add(0.5)
    const breath = time.mul(1.4).add(random.y.mul(TAU)).sin().mul(0.07).add(1)
    const rise = pull.mul(0.62).add(0.3).mul(carrier.mul(0.3).add(0.78)).mul(breath).mul(random.x.mul(0.3).add(0.85))
    // spike profile: a concave cone with a rounded apex, analytic slope so the shading stays smooth at any zoom
    const reach = 0.6
    const rho = spike.distance.div(reach)
    const rounded = rho.mul(rho).add(0.012).sqrt()
    const flank = rounded.min(1).oneMinus()
    const exponent = 2.3
    const profile = flank.pow(exponent)
    const slopeScale = flank.pow(exponent - 1).mul(exponent).mul(rho.div(rounded)).mul(rho.lessThan(1).select(1, 0))
    const height = float(0.075)
    const gradient = spike.delta.div(spike.distance.max(0.0001)).mul(slopeScale.mul(rise).mul(height.div(reach * cellWorld)))
    // unresolved spikes average into a satin sheen instead of shimmering
    const footprint = spike.q.fwidth().length()
    const resolved = ramp(footprint, 0.55, 0.2)
    const basis = knotFrame(tube)
    const tilt = basis.along.mul(gradient.x).add(basis.around.mul(gradient.y)).mul(resolved)
    const surface = normalLocal.normalize()
    const tangentTilt = tilt.sub(surface.mul(tilt.dot(surface)))
    // the apex-relative gradient points outward, so adding it tilts the normal away from the apex (a convex spike)
    const bent = negateOnBackSide(transformNormalToView(surface.add(tangentTilt).normalize()))
    // oily interference film in the valleys, a dark mirror on the crests
    const valley = profile.mul(rise).oneMinus()
    const filmShift = facing.oneMinus().mul(0.8).add(valley.mul(0.5))
    this.colorNode = mix(color(hsl.integer(273, 17, 10)), color(hsl.integer(273, 17, 27)), profile.mul(rise))
    this.metalness = 1
    this.roughnessNode = filteredRoughness(float(0.045).add(resolved.oneMinus().mul(0.2)).add(valley.mul(0.02)), bent)
    this.clearcoat = 0.6
    this.clearcoatRoughnessNode = filteredRoughness(0.03, bent)
    this.iridescence = 0.5
    this.iridescenceIOR = 1.7
    this.iridescenceThicknessNode = filmShift.mul(260).add(180)
    this.normalNode = bent
    this.clearcoatNormalNode = bent
    this.emissiveNode = color(hsl.integer(269, 64, 28)).mul(rim.pow(2)).mul(0.05)
      .add(color(hsl.integer(280, 100, 52)).mul(profile.mul(rise)).mul(pull).mul(0.012))
  }
}
