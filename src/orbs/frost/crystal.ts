import type {Vector3} from 'three/webgpu'

/** refractive index of the frost orb’s fill — real ice */
export const frostFillIor = 1.31

/** the farthest from the orb’s center any part of the sculpted 3D crystal core may reach, keeping its refracted silhouette (`r × 1.31 < 0.85`) cleanly inside the glass rim */
export const crystalBoundRadius = 0.64

/** a tiny snow crystal or sparkling frost mote orbiting inside the glass around the 3D glacial star */
export type FrostFlake = {
  /** initial azimuth in radians */
  angle: number
  /** vertical bobbing speed */
  fall: number
  /** vertical base offset in orb radii */
  height: number
  /** 1 for a crisp tiny sparkling crystal, 0 for a fine snow mote */
  hero: number
  /** angular orbit speed in radians per second */
  orbit: number
  /** shimmer & spin phase */
  phase: number
  /** cylindrical orbit radius in orb radii */
  radius: number
  /** visual radius of the flake in orb radii */
  size: number
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const frac = (x: number) => x - Math.floor(x)
const hash = (index: number, seed: number) => frac(Math.sin(index * 127.1 + seed * 311.7) * 43_758.5453)

/** 72 crisp snow motes and sparkling diamond-dust flecks orbiting through the snow globe vortex, kept strictly inside `r + size < 0.72` so every speck clears the refracted glass rim. */
export const frostFlakes: ReadonlyArray<FrostFlake> = Array.from({length: 72}, (_, index) => {
  const hero = index < 24 ? 1 : 0
  const size = hero ? 0.015 + hash(index, 1.3) * 0.011 : 0.008 + hash(index, 2.7) * 0.008
  const shell = hero ? 0.48 + hash(index, 3.1) * 0.19 : 0.34 + hash(index, 4.9) * 0.34
  const yNorm = (frac(index * 0.618034 + 0.17) * 2 - 1) * 0.85
  const maxRadial = Math.sqrt(Math.max(0.02, shell * shell - (yNorm * shell) ** 2))
  return {
    angle: index * goldenAngle + 0.4,
    radius: Math.max(0.15, maxRadial),
    height: yNorm * shell,
    size,
    orbit: (hero ? 0.36 : 0.56) + hash(index, 5.5) * 0.38,
    fall: 0.05 + hash(index, 6.2) * 0.09,
    phase: hash(index, 7.8) * Math.PI * 2,
    hero,
  }
})

/**
 * Exact CPU mirror of the full-3D glacial snowflake-star sculpture evaluated on GPU in `FrostOrbMaterial.ts`.
 * Uses full 48-fold octahedral symmetry (`Oh`: `|x| >= |y| >= |z|`), producing a true 3D crystalline star with zero flat edge-on angles:
 * - A jewel-cut octahedral crystal heart
 * - 6 primary faceted crystalline arms along `±x, ±y, ±z`, each sprouting two 3D tiers of 45° dendritic ice fern branches in four radial planes
 * - 8 delicate diagonal frost needles along the `(±1, ±1, ±1)` corners
 */
export function crystalDistance(point: Vector3) {
  let a = Math.abs(point.x)
  let b = Math.abs(point.y)
  let c = Math.abs(point.z)
  // Sort into the fundamental octahedral wedge: a >= b >= c >= 0.
  if (a < b) {
    [a, b] = [b, a]
  }
  if (b < c) {
    [b, c] = [c, b]
  }
  if (a < b) {
    [a, b] = [b, a]
  }
  // 1. Jewel-cut octahedral crystal core.
  const core = (a + b + c - 0.19) * 0.57735027
  // 2. Six slender faceted primary arms along ±x, ±y, ±z (reaching r = 0.57).
  const arm = iceBladeDistance(a, b, c, 0.57, 0.052, 0.005)
  // 3. Two 3D tiers of crisp 45° dendritic side-branches sprouting along the (a, b) diagonal off every primary arm.
  const da1 = a - 0.21
  const along1 = (da1 + b) * Math.SQRT1_2
  const aside1 = (-da1 + b) * Math.SQRT1_2
  const branch1 = iceBladeDistance(along1, aside1, c, 0.215, 0.028, 0.004)
  const da2 = a - 0.375
  const along2 = (da2 + b) * Math.SQRT1_2
  const aside2 = (-da2 + b) * Math.SQRT1_2
  const branch2 = iceBladeDistance(along2, aside2, c, 0.135, 0.02, 0.004)
  // 4. Eight slender diagonal crystal needles along (±1, ±1, ±1)/√3 cradling the core.
  const diagAlong = (a + b + c) * 0.57735027
  const diagPerp1 = (a - b) * Math.SQRT1_2
  const diagPerp2 = (a + b - 2 * c) * 0.40824829
  const diag = iceBladeDistance(diagAlong, diagPerp1, diagPerp2, 0.44, 0.032, 0.004)
  const mainStar = smin(Math.min(arm, Math.min(branch1, branch2)), core, 0.012)
  return smin(mainStar, diag, 0.012)
}

/** Smooth polynomial minimum keeping crystalline facets crisp. */
function smin(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k))
  return b * (1 - h) + a * h - k * h * (1 - h)
}
/** Signed distance to a slender, faceted diamond-section ice crystal blade lying along `along` from 0 to `length`. */
function iceBladeDistance(along: number, asideA: number, asideB: number, length: number, w0: number, w1: number) {
  const t = Math.max(0, Math.min(1, along / length))
  const w = w0 + (w1 - w0) * t
  // Crisp diamond cross-section (`|a| + |b| <= w`) in exact Euclidean distance.
  const cross = (Math.abs(asideA) + Math.abs(asideB) - w) * Math.SQRT1_2
  return Math.max(cross, Math.max(along - length, -along))
}
