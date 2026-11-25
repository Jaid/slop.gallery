import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, positionGeometry, time, vec2, vec3} from 'three/tsl'

import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {tubeInterior} from '../../candidates/claude_fable/lib/tubeInterior.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Photophore lattice: cells along and around the body, integers so the rows close on themselves. */
const cellsAlong = 170
const cellsAround = 12
const cellAlong = knotLength / cellsAlong
const cellAround = tubeCircumference / cellsAround
/** A photophore field: one soft lens per lattice cell, each with its own size, phase and color lean. */
function photophores(along: Node<'float'>, around: Node<'float'>, seed: number) {
  const u = along.mul(cellsAlong)
  const v = around.mul(cellsAround)
  const cell = vec2(u.floor(), v.floor())
  const random = cellNoiseVec3(vec3(cell.x, cell.y.mod(cellsAround), seed))
  const random2 = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.mod(cellsAround), seed + 11))
  const center = random.xy.mul(0.5).add(0.25)
  const offset = vec2(u.fract().sub(center.x).mul(cellAlong), v.fract().sub(center.y).mul(cellAround))
  const radius = random.z.mul(0.5).add(0.5).mul(0.016)
  const distance = offset.length()
  const lens = distance.div(radius).pow2().oneMinus().max(0)
  const dome = lens.sqrt()
  return {
    cell,
    distance,
    dome,
    lens,
    radius,
    random,
    random2,
  }
}
/** A deep-sea siphonophore: translucent flesh, rows of pulsing photophores, a dark gut seen through the body and a lure that answers whoever comes close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const {along, around} = tubeCoordinates()
    const interior = tubeInterior(1.36)
    const p = positionGeometry
// Attention: the creature brightens where the viewer looks closest, and more the nearer they come.
    const attention = facing.pow(3).mul(intimate.mul(0.8).add(near.mul(0.2)))
// Photophores, pulsing in a wave that travels down the body; the attended ones swell and brighten.
    const lights = photophores(along, around, 3)
    const wave = time.mul(0.9).sub(along.mul(TAU * 3)).add(lights.random.x.mul(TAU)).sin().mul(0.5).add(0.5).pow(3)
    const slowFade = time.mul(0.23).add(lights.random2.x.mul(TAU)).sin().mul(0.5).add(0.5)
    const pulse = wave.mul(0.7).add(slowFade.mul(0.3)).mul(lights.random2.y.smoothstep(0.05, 0.35))
    const lightColor = mix(mix(rgb(hsl.integer(209, 100, 83)), rgb(hsl.integer(294, 100, 59)), lights.random.z.smoothstep(0.55, 0.75)), rgb(hsl.integer(171, 100, 93.7)), lights.random2.z.smoothstep(0.8, 1))
    const glow = lights.lens.mul(pulse.mul(0.8).add(0.15).add(attention.mul(1.2)))
    const halo = float(1).div(lights.distance.div(lights.radius.mul(2.5)).pow2().add(1)).mul(pulse).mul(0.18)
// Luminous vessels: a faint vascular web, resolved only up close.
    const vessels = cellularBoundary(p.mul(7).add(vec3(2.4, 0.5, 1.1))).smoothstep(0.08, 0.02).mul(near)
    const capillaries = cellularBoundary(p.mul(22).add(vec3(7, 3, 5))).smoothstep(0.05, 0.012).mul(intimate).mul(0.5)
    const vesselPulse = time.mul(1.3).sub(along.mul(TAU * 6)).sin().mul(0.3).add(0.7)
// The lure: the body's first span hangs as a bait, breathing orange and flaring for the attentive.
    const lureSpan = along.smoothstep(0.02, 0.006).max(along.smoothstep(0.98, 0.994))
    const lureBreath = time.mul(0.6).sin().mul(0.5).add(0.5).pow(2)
    const lure = lureSpan.mul(lureBreath.mul(0.5).add(0.5).add(attention.mul(1.5)))
// Gut: a dark cord along the body's axis, visible through the flesh and sliding with parallax.
    const middle = interior.section(interior.at(interior.chord.mul(0.5)))
    const axisDistance = vec2(middle.x, middle.y).length()
    const peristalsis = time.mul(0.5).sub(along.mul(TAU * 14)).sin().mul(0.004)
    const gut = axisDistance.smoothstep(float(0.03).add(peristalsis), float(0.012).add(peristalsis)).mul(facing.smoothstep(0.1, 0.5))
    const gutGlow = axisDistance.smoothstep(0.045, 0.02).mul(time.mul(0.7).sub(along.mul(TAU * 14)).sin().mul(0.5).add(0.5).pow(4))
// Flesh: near-black blue with a wet, wobbling gel surface; photophores are domed lenses.
    const wobble = liquidNormal(near.mul(0.4), 0.35)
    const lensRelief = proceduralNormal(lights.dome.mul(lights.radius).mul(0.8), 1)
    const surfaceNormal = mix(wobble, lensRelief, lights.lens.smoothstep(0, 0.3)).normalize()
    this.normalNode = surfaceNormal
    this.colorNode = mix(rgb(hsl.integer(256, 50, 8)), rgb(hsl.integer(250, 40, 4)), gut.mul(0.9)).add(lightColor.mul(lights.lens).mul(0.1))
    this.metalness = 0
    this.roughnessNode = mix(float(0.12), float(0.05), lights.lens).add(mx_noise_float(p.mul(40)).mul(0.03))
    this.ior = 1.38
    this.transmission = 0.42
    this.thickness = 0.26
    this.attenuationColor.set(hsl.integer(232, 68, 17))
    this.attenuationDistance = 0.35
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.sheen = 0.25
    this.sheenColor.set(hsl.integer(208, 79, 42))
    this.sheenRoughness = 0.7
// Subsurface glow: light scatters through the gel from the photophores and the deep.
    const scatter = rgb(hsl.integer(223, 85, 29)).mul(grazing.pow(2.5)).mul(0.25).add(rgb(hsl.integer(224, 76, 20)).mul(facing.oneMinus()).mul(0.04))
    this.emissiveNode = lightColor.mul(glow.add(halo)).mul(2.6)
      .add(rgb(hsl.integer(175, 94, 74)).mul(vessels.add(capillaries)).mul(vesselPulse).mul(0.25))
      .add(rgb(hsl.integer(38, 100, 65.6)).mul(lure).mul(0.6))
      .add(rgb(hsl.integer(56, 100, 74)).mul(lureSpan).mul(glints(surfaceNormal, 40)).mul(0.3))
      .add(rgb(hsl.integer(183, 82, 56)).mul(gutGlow).mul(0.12))
      .add(scatter)
      .add(rgb(hsl.integer(210, 100, 96)).mul(glints(surfaceNormal, 300)).mul(lights.lens.smoothstep(0.2, 0.6)).mul(0.6))
  }
}
