import type {Node} from 'three/webgpu'

type Offset = Node<'vec2'> | Node<'vec3'>
/**
 * Closed-form integral of a Lorentzian glow 1 / (|e|² + σ²) along a straight segment of offsets `from` → `to` (offsets
 * from the glowing point, in any 2D or 3D frame), over the segment parameter t ∈ [0, 1].
 * Multiply by the segment's length to get the arc-length integral; a ray marcher that does so resolves glowing filaments
 * far thinner than its step without jitter or noise.
 */
export function lorentzianSegment(from: Offset, to: Offset, sigma: number) {
  const delta = to.sub(from)
  const a = delta.lengthSq()
  const b = from.dot(delta).mul(2)
  const c = from.lengthSq().add(sigma * sigma)
  const discriminant = a.mul(c).mul(4).sub(b.pow2()).max(1e-14)
  const root = discriminant.sqrt()
  const integral = a.mul(2).add(b).div(root).atan().sub(b.div(root).atan()).mul(2).div(root)
  return a.lessThan(1e-12).select(c.reciprocal(), integral)
}
/** `lorentzianSegment` normalized so that a full line piercing the glow at right angles sums to 1. */
export function haloSegment(from: Offset, to: Offset, sigma: number) {
  return lorentzianSegment(from, to, sigma).mul(sigma / Math.PI)
}
/**
 * A crisp filament profile with a short tail: the difference of two Lorentzians (σ and 2σ) falls as 1/d⁴ instead of
 * 1/d², so distant filaments do not wash the whole volume in haze. Normalized so that a piercing line sums to 1.
 */
export function filamentSegment(from: Offset, to: Offset, sigma: number): Node<'float'> {
  const narrow = lorentzianSegment(from, to, sigma)
  const wide = lorentzianSegment(from, to, sigma * 2)
  return narrow.sub(wide).mul(2 * sigma / Math.PI).max(0)
}
