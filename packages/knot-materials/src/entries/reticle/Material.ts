import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, max, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, tangentLocal, time, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Rect = {
  edge: Node<'float'>
  mask: Node<'float'>
}
const T = tangentLocal
const B = bitangentLocal as unknown as Node<'vec3'>
/** A rectangular cell field anchored to a jittered 3D lattice, so the floorplan is continuous everywhere on the knot. Every boundary is a real distance, which lets the trenches between cells keep an even width and lets fine fingers fade out once they drop below a pixel. */
const cellField = (p: Node<'vec3'>, pitch: number, seed: number) => {
  const lattice = p.mul(pitch).floor()
  const random = cellNoiseVec3(lattice.add(vec3(seed, seed * 1.7, seed * 0.29)))
  const origin = lattice.add(0.5).add(random.sub(0.5).mul(0.24)).div(pitch)
  const delta = p.sub(origin)
  const q = vec2(delta.dot(T), delta.dot(B)).mul(pitch)
  const foot = q.fwidth().length().max(1e-5)
  return {
    q,
    foot,
    random,
    resolved: foot.smoothstep(0.16, 0.55).oneMinus(),
  }
}
/** A rounded rectangle in cell units, with its outline separated from its fill. */
const rectangle = (q: Node<'vec2'>, half: Node<'vec2'> | number, round: Node<'float'> | number): Rect => {
  const h = typeof half === 'number' ? vec2(half) : half
  const r = typeof round === 'number' ? float(round) : round
  const d = q.abs().sub(h.sub(r)).length().sub(r)
  const foot = d.fwidth().max(1e-5)
  const edge = d.abs().smoothstep(foot.mul(1.6), foot.mul(0.4))
  return {
    mask: edge.oneMinus(),
    edge,
  }
}
/** Parallel metal fingers along one axis, with a trench between every one of them. */
const fingers = (q: Node<'vec2'>, axis: 'x' | 'y', count: number, duty: number, foot: Node<'float'>, resolved: Node<'float'>) => {
  const along = axis === 'x' ? q.x : q.y
  const across = axis === 'x' ? q.y : q.x
  const phase = along.mul(count)
  const line = phase.fract().sub(0.5).abs().smoothstep(float(duty), float(duty).sub(foot.mul(count).mul(1.2))).oneMinus()
  const limit = across.abs().smoothstep(0.36, 0.31).oneMinus()
  return line.mul(limit).mul(resolved)
}
/** A silicon die, seen from above at the magnification where its streets become logic. Four floorplan styles share one continuous lattice – dense logic fingers, an array of sealed memory cells, long analog bus bars with soldered vias, and a ring of bond pads around the edge of every block – so the die never shows a visible tile. A passivation skin floats over all of it, and a probe sweeps the wafer, once, slowly. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, grazing, near, intimate, rim} = viewerFrame()
    const die = cellField(p, 14, 3.7)
    const plan = cellField(p, 2.6, 17.9)
    const style = plan.random.x
    const isLogic = style.smoothstep(0.34, 0.3)
    const isSram = style.smoothstep(0.34, 0.3).oneMinus().mul(style.smoothstep(0.67, 0.63))
    const isAnalog = style.smoothstep(0.67, 0.63).oneMinus()
    const logic = fingers(die.q, 'x', 4, 0.11, die.foot, die.resolved).max(fingers(die.q, 'y', 3, 0.1, die.foot, die.resolved))
    const sramCell = rectangle(die.q.mul(2).fract().sub(0.5), vec2(0.33), 0.07)
    const sramDummy = rectangle(die.q.mul(2).fract().sub(0.5), 0.13, 0.05)
    const sram = sramCell.edge.mul(0.85).add(sramDummy.mask.mul(0.75))
    const bus = fingers(die.q, 'y', 6, 0.13, die.foot.mul(0.6), die.resolved.mul(near.mul(0.6).add(0.4)))
    const via = rectangle(die.q.mul(3).fract().sub(0.5), 0.13, 0.12)
// Bond pads ring the inside of every block, the way a real die is laid out for its package.
    const padRing = rectangle(vec2(plan.q.x.mul(9).fract().sub(0.5), plan.q.y.mul(9).fract().sub(0.5)), vec2(0.3), 0.05)
    const padBand = plan.q.x.abs().max(plan.q.y.abs()).smoothstep(0.44, 0.26)
    const cellBlock = rectangle(die.q, vec2(0.4), 0.05)
    const pads = padRing.mask.mul(padBand)
    const metal = logic.mul(isLogic)
      .add(sram.mul(isSram))
      .add(max(bus, via.mask.mul(0.8)).mul(isAnalog))
      .add(pads.mul(0.9))
      .clamp(0, 1)
    const viaMetal = via.mask.mul(isAnalog)
// The moat between floorplan blocks, and the scribe trenches inside every cell.
    const gap = max(rectangle(plan.q, vec2(0.44), 0.03).edge.mul(1.4), cellBlock.edge)
// Logic, memory and analog blocks are cut from different stock, and the floorplan should read.
    const grain = mx_noise_float(p.mul(28)).mul(0.5).add(0.5).pow(1.5)
    const regionTint = mix(mix(vec3(0.055, 0.062, 0.082), vec3(0.05, 0.07, 0.062), isSram), vec3(0.075, 0.062, 0.048), isAnalog)
    const silicon = mix(vec3(0.012, 0.015, 0.022), regionTint, grain)
    const alloy = mix(color(hsl.integer(97, 36, 37)), color(hsl.integer(100, 27, 62)), mx_noise_float(p.mul(90).add(vec3(2, 3, 4))).mul(0.5).add(0.5))
    const metalColor = mix(alloy, color(hsl.integer(50, 62, 58)), viaMetal)
    let surface = mix(silicon, metalColor, metal.mul(0.92))
    surface = mix(surface, vec3(0.008, 0.009, 0.012), gap.mul(0.85))
    this.colorNode = surface
    this.metalnessNode = metal.mul(0.92).add(0.05)
    this.roughnessNode = mix(float(0.1), float(0.24), metal).add(gap.mul(0.34)).sub(near.mul(0.015)).clamp(0.05, 0.7)
    this.clearcoatNode = float(0.42).sub(metal.mul(0.22)).sub(gap.mul(0.3))
    this.clearcoatRoughnessNode = mix(float(0.045), float(0.3), gap)
    this.iridescenceNode = metal.oneMinus().mul(0.38).mul(grazing.mul(0.8).add(0.2))
    this.iridescenceThicknessNode = mx_noise_float(p.mul(9)).mul(120).add(grazing.mul(220)).add(240)
    this.ior = 1.46
    this.specularIntensityNode = gap.oneMinus().mul(0.85).add(0.15)
    this.sheenNode = gap.mul(0.2)
    this.sheenColor.set(hsl.integer(263, 32, 61))
    this.sheenRoughness = 0.4
    const relief = metal.mul(0.0005).sub(gap.mul(0.0022)).add(viaMetal.mul(0.0004))
    const bump = proceduralNormal(relief, 1.2)
    this.normalNode = bump
// A real die is never perfectly flat: residual stress bows the wafer by microns.
    const bow = mx_fractal_noise_float(p.mul(2.1).add(vec3(7.3, 1.9, 4.7)), 2, 2.1, 0.5)
    this.positionNode = positionGeometry.add(normalLocal.mul(bow.mul(0.0012)))
    const probe = p.x.mul(0.9).add(p.y.mul(0.42)).sub(time.mul(0.42))
    const needle = probe.mul(probe).mul(-46).exp()
    const glint = glints(bump, 190).mul(metal)
    const selfTest = cellNoiseVec3(p.mul(2.4).add(vec3(time.mul(0.11)))).x
    this.emissiveNode = color(hsl.integer(84, 100, 93)).mul(metal.mul(needle).mul(0.5))
      .add(color(hsl.integer(0, 0, 100)).mul(glint.mul(0.28)))
      .add(color(hsl.integer(257, 66, 47)).mul(grazing.pow(2.6).mul(0.2)))
      .add(color(hsl.integer(233, 100, 82.3)).mul(rim.mul(0.045)))
      .add(silicon.mul(selfTest.mul(0.4).add(0.6)).mul(0.05).mul(vec3(0.43, 0.35, 0.16)))
      .add(metal.mul(needle.mul(0.03)))
      .add(color(hsl.integer(255, 61, 73)).mul(intimate.mul(0.02)))
  }
}
