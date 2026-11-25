import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type Curtain = {
  coverage: Node<'float'>
  glow: Node<'vec3'>
  height: Node<'float'>
}

/** The night side of the world, woven rather than painted. Three aurora curtains hang at three depths inside black tourmaline silk: they parallax against one another as you circle, breathe on slow magnetic swells, and resolve – only when you lean in – into fine vertical rays with stars caught in the dark between them. At grazing angles the whole knot rims with the green edge-light every aurora photographer waits for. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const curtain = (depth: number, scale: number, speed: number, seed: number, low: number, high: number): Curtain => {
      const q = p.sub(view.mul(depth))
      const warp = mx_fractal_noise_float(q.mul(scale * 0.5).add(vec3(seed, seed * 0.7, seed * 1.3)), 3, 2, 0.5)
      const drift = vec3(time.mul(speed * 0.37), time.mul(speed * -0.21), seed).add(warp.mul(1.5))
      const field = mx_noise_float(q.mul(scale).add(drift))
      // Curtains are the bright folds where the field crosses zero, with a
      // wide halo and a narrow core – never a flood over the whole surface.
      const ridge = filament(field, 0.085)
      const fold = filament(field, 0.022).mul(0.95).add(ridge.mul(0.32))
      // Fine rays run around the tube, combed by the same warp that bends the
      // curtains; unresolved rays settle to their mean instead of shimmering.
      const rayPhase = tube.y.mul(TAU * 34).add(warp.mul(7)).sub(time.mul(speed * 2.2))
      const rays = opticalBands(rayPhase).mul(0.55).add(0.45)
      const coverage = fold.mul(rays.mul(0.6).add(0.4))
      const tint = mix(color(low), color(high), warp.mul(0.5).add(0.5))
      return {
        glow: tint.mul(coverage),
        coverage,
        height: ridge,
      }
    }
    const outer = curtain(0.02, 5.5, 0.16, 2.4, hsl.integer(153, 100, 85.6), hsl.integer(137.3, 100, 88.3))
    const middle = curtain(0.075, 8.5, 0.11, 6.9, hsl.integer(163, 100, 78.5), hsl.integer(236, 100, 69))
    const inner = curtain(0.14, 13, 0.07, 11.3, hsl.integer(286, 99, 53), hsl.integer(335.8, 100, 69))
    const coverage = outer.coverage.mul(0.8).add(middle.coverage.mul(0.9)).add(inner.coverage.mul(0.8)).clamp()
    const glow = outer.glow.mul(1.05).add(middle.glow.mul(0.55)).add(inner.glow.mul(0.38))
    // One slow magnetic swell travels the length of the knot, brightening
    // whichever curtain it passes through.
    const swellPhase = tube.x.mul(TAU * 2).sub(time.mul(0.4)).add(coverage.mul(2))
    const swell = swellPhase.sin().mul(0.5).add(0.5).pow(3)
    const aliveness = float(0.72).add(swell.mul(0.45)).add(near.mul(0.18))
    // Stars are caught in the weave itself: invisible from across the room,
    // they appear between the rays when the curtains part up close.
    const stars = starfield(p.normalize(), 26, 0.72).mul(coverage.oneMinus()).mul(intimate)
    const nightNoise = mx_noise_float(p.mul(2.4)).mul(0.5).add(0.5)
    const night = mix(color(hsl.integer(274, 45, 3.5)), color(hsl.integer(271, 72, 9)), nightNoise)
    this.colorNode = mix(night, glow, coverage.mul(0.22))
    this.metalness = 0
    this.roughnessNode = float(0.6).sub(coverage.mul(0.22)).clamp(0.32, 0.62)
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.28
    this.sheen = 0.45
    this.sheenColor.set(hsl.integer(169, 96, 80))
    this.sheenRoughness = 0.42
    this.iridescence = 0.35
    this.iridescenceNode = coverage.mul(0.6).clamp()
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = coverage.mul(260).add(140)
    const weave = outer.height.mul(0.5).add(middle.height.mul(0.35)).add(inner.height.mul(0.25))
    this.normalNode = proceduralNormal(weave, 0.0011)
    this.emissiveNode = glow
      .mul(aliveness.mul(0.82))
      .mul(facing.mul(0.35).add(0.75))
      .add(color(hsl.integer(156, 99.9, 86.3)).mul(rim).mul(coverage.mul(0.6).add(0.25)).mul(0.7))
      .add(stars.mul(1.4))
      .add(color(hsl.integer(288, 100, 57.6)).mul(inner.coverage).mul(rim).mul(0.35))
  }
}
