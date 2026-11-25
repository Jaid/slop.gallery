import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv, vec3} from 'three/tsl'

import {glitter} from '../../candidates/deepseek/lib/glitter.ts'
import {loopDrift, loopTurn} from '../../candidates/deepseek/lib/loopClock.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Localized grains keep random facet normals and mineral tints off the cell background. */
function sandGrains(position: Node<'vec3'>, cellSize: number, sharpness: number, tilt: number) {
  const facets = glitter(position, cellSize, sharpness, tilt)
  const q = position.div(cellSize)
  const random = cellNoiseVec3(q.floor())
  const center = random.mul(0.5).add(0.25)
  const outer = q.fwidth().length().add(0.18).min(0.24)
  const mask = q.fract().sub(center).length().smoothstep(0.06, outer).oneMinus()
  return {
    random,
    coverage: mask.mul(facets.resolved),
    lean: facets.lean.mul(mask),
    sparkle: facets.sparkle.mul(mask),
  }
}

/** Wind worked sand, one ripple train at a time. Ripples migrate across the surface on a slow loop, a scouring front travels the length of the knot and briefly flattens them, and the grains themselves are a faceted lattice: each one either catches the key light or stays dull, which is what makes the dune glitter differently from every angle. Loose dust drifts above the surface and only resolves for a visitor who comes close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, grazing, distance, intimate} = viewerFrame()
    const windSeed = mx_noise_float(p.mul(1.6))
    const windAngle = windSeed.mul(1.5).add(p.y.mul(0.7)).add(p.z.mul(0.4))
    const wind = vec3(windAngle.cos(), windAngle.sin(), 0.42).normalize()
    const wavelength = mx_noise_float(p.mul(5.3).add(17)).mul(0.007).add(0.036)
    const phase = p.dot(wind).div(wavelength).sub(loopTurn.mul(2)).add(windSeed.mul(2.4))
// Phase is measured in cycles: `loopTurn` counts laps, so whole numbers keep the wrap seamless.
    const ripple = phase.fract()
    const rippleVisibility = phase.fwidth().smoothstep(0.15, 0.65).oneMinus()
    const sloped = mix(float(0.5), ripple.div(0.74).min(ripple.oneMinus().div(0.26)), rippleVisibility)
    const fineWavelength = wavelength.mul(0.34)
    const finePhase = p.dot(wind.mul(-0.6).add(vec3(0.5, 0.1, 0.85)).normalize()).div(fineWavelength).add(loopTurn.mul(5)).add(windSeed.mul(5.1))
    const fineVisibility = finePhase.fwidth().smoothstep(0.15, 0.65).oneMinus()
    const fineRipple = mix(float(0.5), finePhase.fract().div(0.5).min(finePhase.fract().oneMinus().div(0.5)), fineVisibility)
    const slip = uv().x.sub(loopTurn).fract()
// The gust has to fade at both ends of its lap, or the loop wraps on a hard step.
    const gust = slip.smoothstep(0, 0.12).min(slip.oneMinus().smoothstep(0, 0.12))
    const scouring = slip.mul(slip).mul(-18).exp().mul(gust)
    const crest = sloped.mul(0.75).add(fineRipple.mul(0.25))
    const microCoord = p.mul(90)
    const micro = mx_noise_float(microCoord).mul(microCoord.fwidth().length().smoothstep(0.25, 1).oneMinus())
    const relief = crest.mul(0.34).add(fineRipple.mul(0.08)).add(micro.mul(0.02)).mul(scouring.mul(-0.45).add(1))
    const grain = sandGrains(p, 0.0072, 55, 0.55)
    const grit = sandGrains(p, 0.0034, 44, 0.4)
    const dust = sandGrains(loopDrift(p, 0.035), 0.0055, 45, 0.9)
    const garnet = grain.random
    const grainMask = grain.coverage
    const pale = mix(color(hsl.integer(82, 45, 56)), color(hsl.integer(84, 42, 72)), crest)
    const shadowed = mix(color(hsl.integer(79, 38, 17)), color(hsl.integer(80, 45, 33)), sloped)
    const base = mix(shadowed, pale, sloped.mul(0.55).add(0.3))
    const speckled = mix(base, mix(shadowed, color(hsl.integer(76, 19, 13)), garnet.y.smoothstep(0.72, 0.86)), grainMask.mul(0.35))
    this.colorNode = mix(speckled, mix(color(hsl.integer(29, 68, 44)), color(hsl.integer(74, 27, 40)), garnet.z), grainMask.mul(garnet.x.smoothstep(0.94, 0.975)).mul(0.55))
    this.roughnessNode = mix(float(0.72), float(0.42), grainMask).add(crest.mul(0.08)).sub(intimate.mul(0.06)).clamp(0.2, 0.82)
    this.metalness = 0
    this.normalNode = proceduralNormal(relief, 0.0026).add(grain.lean.mul(0.45)).add(grit.lean.mul(0.2)).normalize()
    this.sheen = 0.12
    this.sheenColor.set(hsl.integer(84, 51, 85))
    this.sheenRoughness = 0.42
    this.emissiveNode = color(hsl.integer(84, 100, 93)).mul(grain.sparkle.mul(crest.mul(0.5).add(0.5)).mul(0.5))
      .add(color(hsl.integer(89, 100, 96.3)).mul(grit.sparkle).mul(intimate).mul(0.4))
      .add(color(hsl.integer(87, 68, 91)).mul(dust.sparkle).mul(intimate.mul(0.8).add(0.2)).mul(0.45))
      .add(color(hsl.integer(80, 53, 70)).mul(scouring.mul(crest.mul(0.3).add(0.2)).mul(0.25)))
      .add(color(hsl.integer(71, 53, 36)).mul(grazing.pow(3)).mul(0.06))
      .add(color(hsl.integer(73, 48, 47)).mul(distance.smoothstep(0.9, 3).oneMinus()).mul(0.04))
  }
}
