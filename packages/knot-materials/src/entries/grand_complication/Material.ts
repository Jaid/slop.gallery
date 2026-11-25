import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, select, time, uv, vec2, vec4} from 'three/tsl'

import {tubeCells} from '../../candidates/claude_sonnet/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const gearsAlong = 36
const gearsAround = 4
/** Gears on a square lattice counter-rotate in a checkerboard; with a multiple of four teeth they stay meshed at every instant. */
const neighbors = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const
/** Escapement time: whole ticks plus an eased advance, so the train steps forward instead of gliding. */
const escapement = (rate: number, offset = 0) => {
  const beat = time.mul(rate).add(offset)
  const eased = beat.fract().smoothstep(0, 0.35)
  return beat.floor().add(eased)
}
/** One layer of the train. Every pixel belongs to at most five gears (its own and the four edge neighbors), so all five are tested and the nearest wins. Returns a signed distance in pitch units (negative inside) plus the owner’s frame. */
function gearTrain(cells: Node<'vec2'>, origin: number, teeth: number, tipRadius: number, rootRadius: number, ticks: Node<'float'>) {
  const base = cells.sub(origin)
  const cell = base.floor()
  const local = base.fract().sub(0.5)
  const parity = cell.x.add(cell.y).mod(2)
  const step = ticks.mul(TAU / teeth)
  let bestDistance: Node<'float'> = float(9)
  let frame: Node<'vec4'> = vec4(0)
  let identity: Node<'float'> = float(0)
  for (const [dx, dy] of neighbors) {
    const q = local.sub(vec2(dx, dy))
    const odd = dx + dy === 0 ? parity : parity.oneMinus()
    const spin = select(odd.lessThan(0.5), step, step.negate().add(Math.PI / teeth))
    const a = atan(q.y, q.x.add(1e-6)).sub(spin)
    const profile = a.mul(teeth).cos().mul(2.4).clamp(-1, 1).mul(0.5).add(0.5)
    const r = q.length()
    const distance = r.sub(mix(float(rootRadius), float(tipRadius), profile))
    const closer = distance.lessThan(bestDistance)
    frame = select(closer, vec4(q, r, a), frame)
    identity = select(closer, odd, identity)
    bestDistance = distance.min(bestDistance)
  }
  return {
    distance: bestDistance,
    frame,
    odd: identity,
  }
}
/** Coverage of a signed distance, antialiased over one pixel. */
const cover = (distance: Node<'float'>, footprint: Node<'float'>) => distance.smoothstep(footprint.negate(), footprint).oneMinus()
/** Tourbillon-grade finishing: yellow and rose gold wheels with circular-grained faces, blued steel beneath, rhodium plate below. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {facing, near, intimate} = viewerFrame()
    const cells = tubeCells(uv(), gearsAlong, gearsAround)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0004)
    const resolved = footprint.smoothstep(0.03, 0.12).oneMinus()
// Engravings fade out as soon as their period nears two pixels, each at its own scale.
    const sunResolved = footprint.smoothstep(0.006, 0.0126).oneMinus()
    const grainResolved = footprint.smoothstep(0.0017, 0.0033).oneMinus()
// Deeper layers shift along the view ray, so the stack slides apart as you move.
    const ray = tubeRay().mul(vec2(gearsAlong, gearsAround))
    const top = gearTrain(cells, 0, 16, 0.552, 0.436, escapement(0.9))
    const under = gearTrain(cells.sub(ray.mul(0.034)), 0.5, 12, 0.53, 0.4, escapement(0.75, 0.4))
    const topQ = top.frame.xy
    const topR = top.frame.z
    const topA = top.frame.w
    const underCover = cover(under.distance, footprint)
// Spoked wheel: hub, jewel setting, five spokes and open windows down to the train below.
    const spoke = topA.mul(5).cos()
    const window = topR.smoothstep(0.17, 0.185).mul(topR.smoothstep(0.315, 0.33).oneMinus()).mul(spoke.smoothstep(0.3, 0.42))
// An inset outline opens a dark clearance line between wheels, so every gear reads as its own part.
    const outline = top.distance.add(0.017)
    const solid = cover(outline, footprint).mul(window.oneMinus())
    const ring = topR.smoothstep(0.335, 0.345).mul(topR.smoothstep(0.42, 0.43).oneMinus())
    const hub = topR.smoothstep(0.16, 0.17).oneMinus()
    const jewel = topR.smoothstep(0.064, 0.072).oneMinus()
    const setting = topR.smoothstep(0.09, 0.1).oneMinus()
// Guilloché: fine radial sunburst on the rim, concentric grain on the hub – only once the eye can resolve them.
    const sunburst = topA.mul(64).cos().mul(0.5).add(0.5).mul(ring).mul(sunResolved)
    const grain = topR.mul(150).cos().mul(0.5).add(0.5).mul(hub.mul(jewel.oneMinus())).mul(grainResolved)
    const engraving = sunburst.add(grain).mul(near.mul(0.6).add(0.4))
// The layer below sits in the shadow of the wheels above it.
    const shadow = outline.smoothstep(0, 0.11).mul(0.7).add(0.3)
    const plateStripes = cells.x.mul(1.2).add(cells.y.mul(0.35)).add(ray.x.mul(0.6)).mul(TAU).sin().mul(0.5).add(0.5)
    const rhodium = mix(color(hsl.integer(254, 11, 41)), color(hsl.integer(251, 11, 77)), plateStripes.mul(resolved).add(resolved.oneMinus().mul(0.5)))
    const steel = mix(color(hsl.integer(264, 59, 13)), color(hsl.integer(261, 57, 30)), under.frame.z.smoothstep(0.2, 0.5))
    const below = mix(rhodium, steel, underCover).mul(shadow)
    const yellow = color(hsl.integer(80, 80, 76))
    const rose = color(hsl.integer(42, 58, 66))
    const gold = mix(yellow, rose, top.odd).mul(engraving.mul(0.22).oneMinus())
    const ruby = color(hsl.integer(22, 97, 42))
    const face = mix(mix(gold, gold.mul(1.15), setting), ruby, jewel)
    this.colorNode = mix(below, face, solid)
    const brightness = float(1)
    this.metalnessNode = mix(float(0.9), select(jewel.greaterThan(0.5), float(0), float(1)), solid)
    this.roughnessNode = mix(mix(float(0.36), float(0.26), underCover), mix(float(0.2).add(engraving.mul(0.08)), float(0.04), jewel), solid)
    const bevel = cover(outline.add(0.012), footprint).mul(0.0024).add(solid.mul(0.0034)).add(underCover.mul(0.0012))
    this.normalNode = proceduralNormal(bevel.add(engraving.mul(0.0004)).mul(brightness), 1)
// Circular brushing: the grain runs around each wheel, so a bright wedge sweeps across it as the view turns.
    const spinAxis = vec2(topQ.y.negate(), topQ.x)
    const around = spinAxis.div(spinAxis.length().max(1e-5))
    this.anisotropyNode = mix(vec2(0, 0.2), around.mul(0.92), solid)
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.06
    this.aoNode = mix(float(0.55), float(1), solid.max(shadow))
// Edge chamfers catch the light, the rubies glow and the escapement flashes on every beat.
    const beat = time.mul(0.9).fract().smoothstep(0, 0.35).oneMinus().pow(2)
    const chamfer = outline.abs().smoothstep(0, 0.014).oneMinus().mul(solid.max(0.4)).mul(facing.mul(0.5).add(0.5))
    this.emissiveNode = color(hsl.integer(92, 100, 95)).mul(chamfer).mul(beat.mul(0.35).add(0.12)).mul(intimate.mul(0.5).add(0.5))
      .add(ruby.mul(jewel).mul(solid).mul(beat.mul(0.6).add(0.35)))
  }
}
