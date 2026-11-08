import type {ProfilePoint} from '../RevolvedProfileGeometry.ts'
import type {BufferGeometry} from 'three/webgpu'

import {Float32BufferAttribute, BufferGeometry as Geometry, LatheGeometry, SphereGeometry, TubeGeometry, Vector2} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import RevolvedProfileGeometry from '../RevolvedProfileGeometry.ts'
import RopeRing from './RopeRing.ts'
import {collarTop, finial, ropeTop} from './stanchion.ts'

const shaftRadius = 0.032
const flare = {
  top: 0.2,
  bottom: 0.045,
  radius: 0.158,
}
/**
 * Turned post profile from the top of the collar under the finial down to the floor: a beaded collar, a slim shaft, a trumpet flare and a weighted base with a rounded rim.
 *
 * Polished metal mirrors every kink of its silhouette, so the flare is a smooth curve instead of a few straight cones.
 */
export const stanchionProfile: ReadonlyArray<ProfilePoint> = [
  [0, collarTop],
  [0.046, collarTop],
  [0.054, collarTop - 0.009],
  [0.056, collarTop - 0.02],
  [0.052, collarTop - 0.031],
  [0.042, collarTop - 0.039],
  [shaftRadius + 0.004, collarTop - 0.049],
  [shaftRadius, collarTop - 0.061],
  ...Array.from({length: 11}, (_, i): ProfilePoint => {
    const t = i / 10
    return [shaftRadius + (flare.radius - shaftRadius) * t ** 2.4, flare.top + (flare.bottom - flare.top) * t]
  }),
  [0.168, 0.041],
  [0.175, 0.033],
  [0.178, 0.022],
  [0.176, 0.01],
  [0.17, 0.002],
  [0.164, 0],
  [0, 0],
]
// The old, coarse profile: close enough to the turned post for the player and thrown objects, at a fraction of the triangles.
const collisionProfile = [[0, 0], [0.17, 0], [0.18, 0.025], [0.16, 0.055], [0.065, 0.09], [0.034, 0.16], [0.034, collarTop - 0.055], [0.052, collarTop - 0.015], [0.052, collarTop + 0.02], [0, collarTop + 0.02]].map(([x, y]) => new Vector2(x, y))
const ropeRadius = 0.028

export type StanchionRingOptions = {
  /** the angle from +x toward +z that the middle of a rope faces. Default: 0 */
  facing?: number
  /** the least height the ropes block walkers up to, filled in by an invisible strip over the ropes wherever they hang lower, so a walker’s step can’t climb them. Default: 0, no strip */
  guard?: number
  /** how far each rope hangs below its ends in its middle */
  sag: number
}

/** A vertical strip along the rope, from its axis to `guard`, over every segment of `segments` where the rope hangs lower, or undefined where it never does. */
function guardStrip(path: RopeRing, segments: number, guard: number) {
  const points = Array.from({length: segments + 1}, (_, i) => path.getPoint(i / segments))
  const positions: Array<number> = []
  const indices: Array<number> = []
  for (let i = 0; i < segments; i++) {
    const [a, b] = [points[i], points[i + 1]]
    if (Math.min(a.y, b.y) >= guard) {
      continue
    }
    const first = positions.length / 3
    // Reaching at least past the rope’s top keeps every quad from collapsing where the rope rises past the guard.
    for (const {x, y, z} of [a, b]) {
      positions.push(x, y, z, x, Math.max(guard, y + ropeRadius), z)
    }
    indices.push(first, first + 2, first + 1, first + 1, first + 2, first + 3)
  }
  if (!indices.length) {
    return
  }
  const strip = new Geometry
  strip.setAttribute('position', new Float32BufferAttribute(positions, 3))
  strip.setIndex(indices)
  return strip
}

/** A closed museum barrier with turned, weighted posts, sagging ropes and lighter collision stand-ins for the posts. */
export default class StanchionRingGeometry {
  /** everything walkers and thrown objects collide with: the coarse posts, the ropes and the guard strip, if any */
  readonly collision: ReadonlyArray<BufferGeometry>
  readonly facing: number
  readonly guard: number
  /** an invisible strip from the ropes up to {@link guard} wherever they hang lower */
  readonly guardStrip?: BufferGeometry
  /** coarse posts for collision */
  readonly postCollision: BufferGeometry
  /** turned posts with their ball finials, finely tessellated for polished metal */
  readonly posts: BufferGeometry
  readonly rope: BufferGeometry
  readonly sag: number

  constructor(readonly radius: number, readonly count: number, {sag, facing = 0, guard = 0}: StanchionRingOptions) {
    if (!Number.isFinite(radius) || radius <= 0 || !Number.isSafeInteger(count) || count < 3) {
      throw new RangeError('A stanchion ring needs a positive radius and at least three posts.')
    }
    if (!(sag >= 0 && sag < ropeTop)) {
      throw new RangeError('A stanchion ring’s ropes must sag above the floor.')
    }
    this.sag = sag
    this.facing = facing
    this.guard = guard
    const path = new RopeRing(radius, count, sag, facing)
    const metal: Array<BufferGeometry> = []
    const collision: Array<BufferGeometry> = []
    for (let i = 0; i < count; i++) {
      // Every post stands where its ropes hang from.
      const {x, z} = path.getPoint(i / count)
      const post = new RevolvedProfileGeometry(stanchionProfile, {sides: 24})
      const ball = new SphereGeometry(finial.radius, 24, 16)
      metal.push(post.translate(x, 0, z), ball.translate(x, finial.y, z))
      const collisionPost = new LatheGeometry(collisionProfile, 12)
      const collisionBall = new SphereGeometry(finial.radius, 12, 8)
      collision.push(collisionPost.translate(x, 0, z), collisionBall.translate(x, finial.y, z))
    }
    this.posts = mergeParts(metal)
    this.postCollision = mergeParts(collision)
    const segments = count * 16
    this.rope = new TubeGeometry(path, segments, ropeRadius, 12, true)
    const uvAttribute = this.rope.getAttribute('uv')
    for (let i = 0; i < uvAttribute.count; i++) {
      // Tube u already runs by arc length, so braid repeats land every 33 mm and meet at the loop’s seam.
      uvAttribute.setX(i, uvAttribute.getX(i) * path.getLength() * 30)
    }
    this.guardStrip = guardStrip(path, segments, guard)
    this.collision = [this.postCollision, this.rope, ...this.guardStrip ? [this.guardStrip] : []]
  }

  dispose() {
    this.posts.dispose()
    this.postCollision.dispose()
    this.rope.dispose()
    this.guardStrip?.dispose()
  }
}
