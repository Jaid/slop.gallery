import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {enamel, etch, filteredCos, ornamentCell, polarAngle, polarTicks} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Jewel-toned blown-glass petals between raised lead cames and chased bronze tracery. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = data.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const {q, random} = ornamentCell(tube, 16, 2, 19)
    const local = vec2(q.x.mul(1.1), q.y)
    const r = local.length()
    const a = polarAngle(local)
    const roseRadius = a.mul(8).cos().mul(0.025).add(0.385)
    const outer = etch(r.sub(roseRadius), 0.012)
    const inner = etch(r.sub(0.265), 0.009)
    const center = etch(r.sub(0.079), 0.009)
    const spokes = etch(a.mul(4).sin().mul(r), 0.008)
      .mul(enamel(r.sub(roseRadius))).mul(enamel(float(0.079).sub(r)))
    const borders = etch(q.x.abs().max(q.y.abs()).sub(0.485), 0.008)
    const came = outer.add(inner).add(center).add(spokes).add(borders).clamp()
    const rose = enamel(r.sub(roseRadius))
    const bronze = outer.add(borders).clamp()
    const sector = a.add(Math.PI).div(TAU).mul(8).floor()
    const identity = sector.add(random.z.mul(5).floor()).mod(5)
    let stainedGlass: Node<'vec3'> = color(hsl.integer(15, 88, 46.7)).mul(1)
    stainedGlass = mix(stainedGlass, color(hsl.integer(78, 87, 75)), identity.smoothstep(0.5, 0.6))
    stainedGlass = mix(stainedGlass, color(hsl.integer(176, 93, 50)), identity.smoothstep(1.5, 1.6))
    stainedGlass = mix(stainedGlass, color(hsl.integer(266, 90, 39)), identity.smoothstep(2.5, 2.6))
    stainedGlass = mix(stainedGlass, color(hsl.integer(324, 70, 41.6)), identity.smoothstep(3.5, 3.6))
    const rosette = enamel(r.sub(0.07))
    const ground = mix(color(hsl.integer(254, 56, 27)), color(hsl.integer(353, 69, 28)), random.x)
    const jewels = mix(ground, stainedGlass, rose)
    const centerGlass = mix(jewels, color(hsl.integer(80, 86, 80)), rosette)
    const glassRipple = mx_noise_float(p.mul(vec3(27, 8, 18))).mul(0.5).add(0.5)
    const ripples = mx_noise_float(p.mul(65).add(glassRipple.mul(0.8))).mul(0.5).add(0.5)
    const depthNoise = mx_noise_float(p.sub(view.mul(0.09)).mul(15).add(vec3(0, time.mul(0.028), 0)))
    const caustic = filteredCos(depthNoise.mul(21).add(r.mul(12))).mul(0.5).add(0.5)
    const litGlass = centerGlass.mul(glassRipple.mul(0.34).add(0.6))
    const lead = mix(color(hsl.integer(258, 23, 12)), color(hsl.integer(248, 9, 35)), glassRipple)
    const frame = mix(lead, color(hsl.integer(78, 60, 63)), bronze)
    // Refracted light enters independently of the painted window, giving a real depth cue while orbiting.
    const innerCell = ornamentCell(tube.sub(tubeRay().mul(0.054)), 16, 2, 19)
    const focus = etch(innerCell.q.length().sub(0.21), 0.014).mul(rose).mul(0.22)
    const chase = polarTicks(local, 80, 0.065)
      .mul(etch(r.sub(roseRadius), 0.006)).mul(intimate)
    const bubbleCell = ornamentCell(tube, 240, 24, 63)
    const bubbleCenter = bubbleCell.random.xy.sub(0.5).mul(0.42)
    const bubbleD = bubbleCell.q.sub(bubbleCenter).length()
    const bubbles = etch(bubbleD.sub(0.075), 0.01).mul(bubbleCell.random.z.smoothstep(0.79, 0.86))
      .mul(bubbleCell.grid.fwidth().length().smoothstep(0.2, 0.8).oneMinus())
    const passingSun = tube.x.mul(TAU * 2).sub(time.mul(0.31)).cos().mul(0.5).add(0.5)
    this.colorNode = mix(litGlass, frame, came).add(color(hsl.integer(87, 55, 84)).mul(chase).mul(0.13))
    this.metalnessNode = came.mul(0.87)
    this.roughnessNode = mix(float(0.19).add(ripples.mul(0.065)), float(0.32), came)
    this.transmission = 0.48
    this.transmissionNode = came.oneMinus().mul(0.48)
    this.thicknessNode = float(0.18).add(glassRipple.mul(0.08))
    this.attenuationColor.set(hsl.integer(239, 33, 87))
    this.attenuationDistance = 0.75
    this.ior = 1.51
    this.dispersion = 0.025
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.085
    this.normalNode = proceduralNormal(came.mul(0.0013).add(glassRipple.mul(0.0009))
      .add(ripples.mul(0.00007)).sub(bubbles.mul(0.00009)), 0.65)
    this.clearcoatNormalNode = proceduralNormal(glassRipple.mul(0.00065).add(came.mul(0.001)), 0.5)
    this.emissiveNode = centerGlass.mul(came.oneMinus())
      .mul(caustic.mul(0.16).add(passingSun.mul(0.16)).add(0.16))
      .mul(facing.mul(0.4).add(0.6)).mul(near.mul(0.15).add(0.85))
      .add(color(hsl.integer(74, 100, 90.6)).mul(focus).mul(came.oneMinus()).mul(0.35))
      .add(color(hsl.integer(216, 54, 92)).mul(bubbles).mul(grazing).mul(0.04))
  }
}
