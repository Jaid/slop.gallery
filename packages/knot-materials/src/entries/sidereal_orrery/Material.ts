import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec2, vec3} from 'three/tsl'

import {polarAngle} from '../../candidates/gpt_astra/lib/surface/angle.ts'
import {fill, ruled, stroke, wave} from '../../candidates/gpt_astra/lib/surface/coverage.ts'
import {exhibitionFrame} from '../../candidates/gpt_astra/lib/surface/frame.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Rounded teeth, six open spokes and a raised axle; the holes expose the next stratum. */
function gear(q: Node<'vec2'>, radius: number, teeth: number, rotation: Node<'float'>, aa: Node<'float'>) {
  const r = q.length().max(0.00001)
  const angle = polarAngle(q).add(rotation)
  const tooth = angle.mul(teeth).sin().smoothstep(-0.3, 0.3).mul(0.018)
  const outside = fill(r.sub(tooth.add(radius)), aa)
  const ring = outside.mul(r.smoothstep(radius * 0.65, radius * 0.65 + 0.015))
  const spokes = ruled(angle.div(TAU).mul(6), 0.055).mul(outside)
  const hub = fill(r.sub(0.031), aa)
  return ring.add(spokes).add(hub).clamp()
}
/** Gilded orreries turn beneath enamel dials and watchmaker glass, revealing independently moving mechanisms at different depths. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.92)
    this.name = knotData.id
    const {near, intimate, facing, grazing} = exhibitionFrame()
    const grid = uv().mul(vec2(18, 2))
    const q = grid.fract().sub(0.5)
    const aa = grid.fwidth().length()
    const identity = cellNoiseVec3(vec3(wrapCell(grid.floor(), vec2(18, 2)), 17))
    const radius = q.length().max(0.00001)
    const angle = polarAngle(q)
    const glass = fill(radius.sub(0.383), aa)
    const bezel = stroke(radius.sub(0.417), 0.027, aa)
    const rim = stroke(radius.sub(0.465), 0.006, aa).add(stroke(radius.sub(0.38), 0.009, aa))
    const chapter = ruled(angle.div(TAU).mul(48), 0.095).mul(stroke(radius.sub(0.346), 0.018, aa))
    const hours = ruled(angle.div(TAU).mul(12), 0.048).mul(stroke(radius.sub(0.334), 0.032, aa))
    const ray = tubeRay().mul(vec2(18, 2))
    const phase = time.mul(0.19).add(identity.x.mul(TAU))
    const deep = q.sub(ray.mul(0.025))
    const back = gear(deep.add(vec2(0.13, 0.09)), 0.175, 20, phase, aa)
    const front = gear(q.sub(ray.mul(0.012)).sub(vec2(0.125, 0.085)), 0.137, 16, phase.mul(-1.25), aa)
    const bridge = stroke(deep.y.add(deep.x.mul(0.6)), 0.016, aa).mul(fill(deep.length().sub(0.28), aa))
    const mechanism = back.mul(0.52).add(front.mul(0.9)).add(bridge.mul(0.55)).clamp().mul(glass)
    const handAngle = phase.mul(0.4)
    const handSpace = vec2(q.x.mul(handAngle.cos()).add(q.y.mul(handAngle.sin())), q.y.mul(handAngle.cos()).sub(q.x.mul(handAngle.sin())))
    const hand = fill(handSpace.x.abs().sub(0.007).max(handSpace.y.sub(0.105).abs().sub(0.17)), aa)
    const planetPosition = vec2(phase.cos(), phase.sin()).mul(0.283)
    const planet = fill(q.sub(planetPosition).length().sub(0.023), aa)
    const orbit = stroke(deep.length().sub(0.283), 0.004, aa)
    const axle = fill(radius.sub(0.024), aa)
    const engraving = ruled(radius.mul(220), 0.12).mul(bezel).mul(intimate)
    const goldMask = bezel.add(rim).add(chapter).add(hours).add(hand).add(axle).add(mechanism).add(orbit.mul(0.35)).clamp()
    const enamel = mix(color(hsl.integer(242, 34, 12)), color(hsl.integer(206, 38, 28)), identity.z.mul(0.4).add(grazing.mul(0.26)))
    const brass = mix(color(hsl.integer(67, 61, 38)), color(hsl.integer(80, 63, 78)), goldMask.mul(0.55).add(facing.mul(0.25)))
    const body = mix(color(hsl.integer(33, 15, 15)), enamel, glass)
    this.colorNode = mix(mix(body, brass.mul(engraving.mul(-0.15).add(1)), goldMask), color(hsl.integer(9, 82, 36)), planet)
    this.metalnessNode = goldMask.mul(0.62).add(0.28).sub(planet.mul(0.5)).clamp()
    this.roughnessNode = float(0.3).sub(glass.mul(0.12)).add(engraving.mul(0.08))
    this.clearcoatNode = glass.mul(0.85).add(0.12)
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(bezel.mul(0.0012).add(rim.mul(0.00035)).add(mechanism.mul(0.0003)).add(engraving.mul(0.000035)), 1)
    const heartbeat = wave(time.mul(0.7).add(identity.x.mul(TAU)))
    this.emissiveNode = color(hsl.integer(24, 86, 63.6)).mul(planet).mul(heartbeat.mul(0.3).add(0.12)).mul(near.mul(0.5).add(0.5))
  }
}
