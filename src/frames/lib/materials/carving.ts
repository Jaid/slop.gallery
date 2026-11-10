import type {FrameSurface} from './frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {abs, clamp, float, max, select, smoothstep} from 'three/tsl'

import {visibleDetail} from '#src/lib/materials/filters.ts'

import {fittedPeriod} from './frameAttributes.ts'

type Float = Node<'float'>

/**
 * Carved ornament for frames as height fields from 0 to 1, to scale by a depth and hand to a material’s relief: classical enrichments repeating along a band of the moulding, fitted so a whole number of them runs into each miter.
 *
 * A band lies between two offsets past the opening; `t` is where a point lies within it, 0 at its inner edge and 1 at its outer one.
 */

/** where the point lies across the band from `from` to `to` meters out past the opening, and 1 inside it, 0 outside */
export function band(surface: FrameSurface, from: number, to: number) {
  const t = surface.reach.sub(from).div(to - from)
  return {
    t: clamp(t, 0, 1),
    inside: select(t.greaterThanEqual(0).and(t.lessThanEqual(1)).and(surface.isOrnament.lessThan(0.5)), float(1), float(0)),
  }
}

/** The phase along the member, 0 to 1 per repeat, of a pattern repeating about every `period` meters on a band `reach` out past the opening, symmetric about the member’s middle and meeting itself in the miters. */
export function repeatPhase(surface: FrameSurface, period: number, reach: number) {
  const fitted = fittedPeriod(surface.openingHalf, period, reach)
  return surface.along.div(fitted).fract()
}

/** Fades a carving to its average before its features, `size` meters across, get small enough to shimmer. */
export function legible(surface: FrameSurface, height: Float, size: number) {
  const p = surface.position
  const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
  return height.mul(visibleDetail(footprint, size)).add(float(0.5).mul(visibleDetail(footprint, size).oneMinus()))
}

const dome = (x: Float, y: Float) => clamp(float(1).sub(x.mul(x)).sub(y.mul(y)), 0, 1).sqrt()

/** Bead and reel along a round: a long bead and two thin reels per repeat. */
export function beadAndReel(phase: Float, t: Float) {
  const across = t.mul(2).sub(1)
  const bead = dome(phase.sub(0.32).div(0.3), across)
  const reel = (center: number) => dome(phase.sub(center).div(0.06), across.mul(0.9)).mul(0.8)
  return max(bead, max(reel(0.74), reel(0.89)))
}

/** Acanthus leaves along a band, each a lobed leaf with a raised midrib, overlapping the next. */
export function acanthus(phase: Float, t: Float) {
  const x = phase.sub(0.5).mul(2)
  // The leaf narrows toward its tip at the band’s outer edge, its edge scalloped into lobes.
  const width = float(1).sub(t.mul(t).mul(0.8)).mul(float(0.82).add(t.mul(14).sin().abs().mul(0.18)))
  const leaf = smoothstep(0.16, -0.1, abs(x).sub(width))
  const midrib = smoothstep(0.12, 0, abs(x)).mul(0.35)
  const veins = abs(x.mul(5).sub(t.mul(3)).sin()).mul(0.15)
  const cup = float(1).sub(abs(x).div(max(width, float(0.05)))).mul(0.55).add(0.35)
  const curl = smoothstep(0.75, 1, t).mul(0.25)
  return leaf.mul(cup.add(midrib).sub(veins).add(curl))
}

/** A ribbon wound round a rod: diagonal bands with grooves between. */
export function ribbon(phase: Float, t: Float) {
  const twist = phase.add(t.mul(0.5)).fract()
  return smoothstep(0, 0.12, twist).mul(smoothstep(1, 0.7, twist)).mul(dome(float(0), t.mul(2).sub(1)))
}

/** Gadroons: convex lobes side by side, tilted a little. */
export function gadroons(phase: Float, t: Float) {
  const x = phase.add(t.mul(0.25)).fract().sub(0.5).mul(2)
  return dome(x, t.mul(2).sub(1).mul(0.6))
}

/** Round reeds side by side across a band, `count` of them. */
export function reeds(t: Float, count: number) {
  const x = t.mul(count).fract().sub(0.5).mul(2)
  return dome(x, float(0))
}
