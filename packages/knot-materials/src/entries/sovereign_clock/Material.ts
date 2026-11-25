import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, uv, vec2} from 'three/tsl'

import {buriedUv} from '../../candidates/gpt_sol/lib/exhibition/buriedOptics.ts'
import {exhibitionPhase} from '../../candidates/gpt_sol/lib/exhibition/clock.ts'
import {angularFootprint, fill, stroke, tiles, wave} from '../../candidates/gpt_sol/lib/exhibition/ornamentFields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function gear(p: Node<'vec2'>, rotation: Node<'float'>, radius: number, teeth: number, spokeCount = 6) {
  const r = p.length()
  const angle = p.y.atan(p.x).sub(rotation)
  const footprint = angularFootprint(p)
  const tooth = wave(angle.mul(teeth), footprint.mul(teeth)).smoothstep(0.32, 0.68)
  const outline = r.sub(tooth.mul(0.021).add(radius))
  const disk = fill(outline)
  const rim = fill(r.sub(radius - 0.023)).oneMinus().mul(disk)
  const hub = fill(r.sub(0.059))
  const spokes = wave(angle.mul(spokeCount), footprint.mul(spokeCount)).smoothstep(0.77, 0.88).mul(disk)
  const body = rim.max(hub).max(spokes)
  const bevel = stroke(outline, 0.006).max(stroke(r.sub(radius - 0.028), 0.006)).mul(body)
  const engraving = stroke(r.sub(radius - 0.012), 0.003).mul(body)
  return {
    body,
    r,
    angle,
    bevel,
    engraving,
    hub,
  }
}

/** Openworked watch plates, counter-rotating escape wheels, screw slots and polished ruby pivots. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const {view, facing, near, intimate} = viewerFrame()
    const front = tiles(tube, [20, 3], 41, false)
    const q = front.local
    const r = q.length()
    const port = fill(r.sub(0.395))
    const lip = stroke(r.sub(0.405), 0.01).max(stroke(r.sub(0.37), 0.006))
    const angle = q.y.atan(q.x)
    const minorTicks = stroke(angle.mul(30).sin(), 0.065).mul(fill(r.sub(0.375))).mul(fill(r.negate().add(0.354)))
    const majorTicks = stroke(angle.mul(6).sin(), 0.065).mul(fill(r.sub(0.375))).mul(fill(r.negate().add(0.334)))
    const ticks = minorTicks.max(majorTicks)
    const rotation = exhibitionPhase.div(3).add(front.random.z.mul(TAU))
    const under = tiles(buriedUv(tube, view, 0.032, 1.13), [20, 3], 41, false).local.sub(vec2(0.13, -0.095))
    const back = gear(under, rotation.mul(-3 / 4), 0.217, 24, 8)
    const topQ = tiles(buriedUv(tube, view, 0.009, 1.13), [20, 3], 41, false).local
    const top = gear(topQ, rotation, 0.292, 18)
    const brushed = wave(tube.y.mul(TAU * 480).add(tube.x.mul(TAU * 24).sin().mul(0.9)))
    const plate = mix(color(hsl.integer(59, 61, 36)), color(hsl.integer(79, 60, 64)), brushed.mul(0.2).add(0.6))
    let inside: Node<'vec3'> = color(hsl.integer(224, 11, 12)).mul(1)
    inside = mix(inside, mix(color(hsl.integer(147, 18, 36)), color(hsl.integer(119, 20, 72)), back.bevel.mul(0.65).add(0.3)), back.body)
    inside = mix(inside, mix(color(hsl.integer(75, 63, 45)), color(hsl.integer(86, 64, 82)), top.bevel.mul(0.5).add(0.48)), top.body)
    inside = mix(inside, color(hsl.integer(66, 65, 31)), top.engraving.mul(0.7))
    const bearing = fill(top.r.sub(0.042)).mul(port)
    const gem = mix(color(hsl.integer(9, 76, 11.5)), color(hsl.integer(17, 93, 50)), top.r.div(0.046).oneMinus().clamp().mul(facing.mul(0.6).add(0.4)))
    inside = mix(inside, gem, bearing)
// Four flush screws per plate; diagonal slots rotate with their individual identities, not the wheels.
    let screws: Node<'float'> = float(0)
    let slots: Node<'float'> = float(0)
    for (const x of [-0.425, 0.425]) {
      for (const y of [-0.425, 0.425]) {
        const s = q.sub(vec2(x, y))
        const head = fill(s.length().sub(0.032))
        screws = screws.max(head)
        slots = slots.max(stroke(s.x.add(s.y.mul(0.65)), 0.006).mul(head))
      }
    }
    let surface: Node<'vec3'> = mix(plate, inside, port)
    surface = mix(surface, color(hsl.integer(101, 35, 88)), lip.mul(0.7).max(screws))
    surface = mix(surface, color(hsl.integer(80, 15, 20)), ticks.max(slots).mul(0.85))
    this.colorNode = surface
    this.metalnessNode = mix(float(0.97), float(0.05), bearing).sub(port.mul(top.body.max(back.body).oneMinus()).mul(0.6)).clamp()
    this.roughnessNode = float(0.29).sub(top.bevel.mul(port).mul(0.14)).sub(bearing.mul(0.23)).add(slots.mul(0.3)).clamp(0.055, 0.6)
    this.anisotropyNode = vec2(0, 1).mul(bearing.oneMinus()).mul(0.42)
    this.clearcoatNode = bearing.mul(0.92).add(0.08)
    this.clearcoatRoughness = 0.025
    this.ior = 1.77
    const relief = lip.mul(0.0015).add(screws.mul(0.0008)).sub(slots.mul(0.0004))
      .add(top.body.mul(port).mul(0.0011)).add(top.bevel.mul(port).mul(0.0004)).sub(ticks.mul(0.00015))
    this.normalNode = proceduralNormal(relief.add(brushed.mul(intimate).mul(0.000025)), 1)
    this.aoNode = port.mul(top.body.oneMinus()).mul(0.43).oneMinus()
    const jewelReturn = top.angle.mul(3).cos().abs().pow(12).mul(near).mul(bearing)
    this.emissiveNode = color(hsl.integer(17, 90, 55)).mul(jewelReturn).mul(0.1).add(inside.mul(port).mul(0.055))
  }
}
