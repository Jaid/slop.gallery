import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalLocal, refract, time, vec3, vec4} from 'three/tsl'

import {segmentDistance} from '../../candidates/claude_opus/lib/segmentDistance.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {knotCurve} from '../../lib/knotCurve.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Slot = {
  age: Node<'float'>
  id: Node<'float'>
  life: Node<'float'>
}
/** A recurring event: every `period` seconds a new particle takes this slot, and `age` counts seconds since it passed. */
function slot(period: number, phase: number): Slot {
  const cycle = time.div(period).add(phase)
  return {
    id: cycle.floor(),
    age: cycle.fract().mul(period),
    life: cycle.fract(),
  }
}
const random = (id: Node<'float'>, seed: number, salt: number) => cellNoiseVec3(vec3(id, seed, salt))
const direction = (r: Node<'vec3'>) => r.mul(2).sub(1).add(vec3(0.001, 0, 0)).normalize()
/** A random point inside the glass tube, so each event happens in the chamber, not in the room. */
const pointInTube = (id: Node<'float'>, seed: number) => {
  const a = random(id, seed, 1.1)
  const b = random(id, seed, 2.2)
  return knotCurve(a.x.mul(TAU * 2)).add(b.mul(2).sub(1).mul(0.075))
}
/** A diffusion cloud chamber: alpha stars from two radioactive needles, cosmic muons raining straight through and scattered beta electrons, condensing as trails that drift, broaden and fade in a cold alcohol mist. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const up = modelWorldMatrixInverse.mul(vec4(0, 1, 0, 0)).xyz.normalize()
// The view ray refracts into the glass and crosses the chamber along a chord.
    const ray = refract(view.negate(), n, float(1 / 1.45)).normalize()
    const chord = facing.mul(0.25).add(0.012)
// One pixel’s footprint in object units: trails never get thinner than this, they only get fainter.
    const footprint = p.fwidth().length().max(0.0002)
// One shared vapor current tears every old trail apart, so more events cost almost nothing.
    const tear = mx_noise_vec3(p.mul(26).add(vec3(0, time.mul(0.12), 0)))
    let trails: Node<'vec3'> = vec3(0)
    const trail = (event: Slot, origin: Node<'vec3'>, heading: Node<'vec3'>, s0: number, s1: Node<'float'> | number, width: number, tint: Node<'color'>, decay: number) => {
// Old trails sag, broaden and get torn by the drifting vapor.
      const sagged = origin.sub(up.mul(event.age.mul(0.01)))
      const torn = p.add(tear.mul(event.age.mul(0.005)))
      const closest = segmentDistance(torn, ray, chord, sagged, heading, float(s0), typeof s1 === 'number' ? float(s1) : s1)
      const spread = event.age.mul(0.003).add(width)
      const effective = spread.max(footprint.mul(0.6))
// Sub-pixel trails widen to one pixel and dim only by the square root of the lost width, so far trails stay legible.
      const profile = closest.x.div(effective).pow2().negate().exp().mul(spread.div(effective).sqrt())
      const fade = event.age.smoothstep(0, 0.05).mul(event.age.mul(-decay).exp())
      const cooled = mix(tint, color(hsl.integer(259, 35, 61)), event.life.smoothstep(0.1, 0.9))
      return {
        intensity: profile.mul(fade),
        s: closest.y,
        color: cooled,
      }
    }
// Alpha particles: short, thick, dead-straight tracks bursting from two needle sources, thickening at their Bragg peak.
    const sources = [knotCurve(float(1.3)), knotCurve(float(8.6))]
    for (const [index, source] of sources.entries()) {
      for (let i = 0;i < 11;i++) {
        const seed = index * 20 + i
        const event = slot(1.6 + i * 0.11, i / 11 + index * 0.31)
        const r = random(event.id, seed, 3.3)
        const length = r.x.mul(0.035).add(0.07)
        const alpha = trail(event, source, direction(random(event.id, seed, 4.4)), 0.012, length, 0.0019, color(hsl.integer(265, 100, 98)), 1.15)
        const braggPeak = alpha.s.div(length).smoothstep(0.4, 1).mul(0.6).add(0.8)
        trails = trails.add(alpha.color.mul(alpha.intensity).mul(braggPeak).mul(r.y.smoothstep(0.08, 0.2)).mul(2.2))
      }
    }
// Radon in the gas: lone alpha decays anywhere in the chamber, each a single fat track with a faint recoil stub behind it.
    for (let i = 0;i < 16;i++) {
      const seed = 100 + i
      const event = slot(1.8 + i * 0.09, i / 16)
      const origin = pointInTube(event.id, seed)
      const heading = direction(random(event.id, seed, 8.8))
      const r = random(event.id, seed, 9.9)
      const length = r.x.mul(0.04).add(0.06)
      const alpha = trail(event, origin, heading, 0, length, 0.0021, color(hsl.integer(265, 100, 98)), 1.2)
      const braggPeak = alpha.s.div(length).smoothstep(0.4, 1).mul(0.6).add(0.8)
      const recoil = trail(event, origin, heading.negate(), 0, 0.006, 0.0016, color(hsl.integer(265, 100, 98)), 1.2)
      trails = trails.add(alpha.color.mul(alpha.intensity.mul(braggPeak).add(recoil.intensity.mul(0.6))).mul(2))
    }
// Cosmic muons: rare, long, faint and arrow-straight, falling from the sky with beaded ionization.
    for (let i = 0;i < 9;i++) {
      const seed = 50 + i
      const event = slot(2.3 + i * 0.37, i * 0.29)
      const heading = up.mul(-2.4).add(random(event.id, seed, 5.5).mul(2).sub(1)).normalize()
      const muon = trail(event, pointInTube(event.id, seed), heading, -1.6, 1.6, 0.0009, color(hsl.integer(265, 100, 93)), 0.8)
      const beads = mx_noise_float(vec3(muon.s.mul(420), event.id, seed)).smoothstep(-0.25, 0.45).mul(0.6).add(0.4)
      trails = trails.add(muon.color.mul(muon.intensity).mul(beads).mul(1.5))
    }
// Beta electrons: thin, faint and wandering, scattered off course at every collision.
    for (let i = 0;i < 14;i++) {
      const seed = 70 + i
      const event = slot(1.9 + i * 0.23, i * 0.13)
      let start = pointInTube(event.id, seed)
      let heading = direction(random(event.id, seed, 6.6))
      for (let segment = 0;segment < 4;segment++) {
        const r = random(event.id, seed, 7.7 + segment)
        const length = r.x.mul(0.03).add(0.03)
        const beta = trail(event, start, heading, 0, length, 0.0008, color(hsl.integer(264, 100, 90)), 1.4)
        trails = trails.add(beta.color.mul(beta.intensity).mul(1.2))
        start = start.add(heading.mul(length))
        heading = heading.add(r.mul(2).sub(1).mul(1.3)).normalize()
      }
    }
// The needles themselves, faintly warm in the side lamp.
    let needles: Node<'float'> = float(0)
    for (const source of sources) {
      const tip = segmentDistance(p, ray, chord, source, up, float(-0.025), float(0.006))
      needles = needles.add(tip.x.div(footprint.mul(0.6).max(0.0022)).pow2().negate().exp())
    }
// Supersaturated vapor: a faint, slowly sinking haze, densest deep in the chamber, with droplets raining through it up close.
    const drift = up.mul(time.mul(-0.02))
    let haze: Node<'float'> = float(0)
    for (const depth of [0.25, 0.55, 0.85]) {
      const q = p.add(ray.mul(chord.mul(depth))).add(drift)
      haze = haze.add(mx_noise_float(q.mul(7)).mul(0.5).add(0.5).smoothstep(0.45, 0.85))
    }
    const rain = cellularPoints(p.sub(view.mul(0.03)).add(up.mul(time.mul(0.05))).mul(110), 0.03, 0.14, 0.8).mul(intimate)
    this.colorNode = color(hsl.integer(256, 37, 2))
    this.metalness = 0
    this.roughness = 0.05
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    const chamber = color(hsl.integer(253, 37, 14)).mul(haze.div(3)).mul(facing.mul(0.6).add(0.2)).mul(near.mul(0.5).add(0.5))
    this.emissiveNode = trails.mul(facing.mul(0.4).add(1.2)).add(color(hsl.integer(56, 100, 79.6)).mul(needles).mul(0.7)).add(chamber).add(color(hsl.integer(258, 42, 81)).mul(rain).mul(0.3)).add(color(hsl.integer(253, 46, 38)).mul(grazing.pow(4)).mul(0.18))
  }
}
