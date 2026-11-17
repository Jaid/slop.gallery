import type {Vec3} from '../types.ts'

import {clamp} from 'math'
import {Curve, Quaternion, Vector3} from 'three/webgpu'

export type RailingAnchor = {
  ground: Vec3
  height: number
  /** An unsupported end tip; its neighboring anchor carries the last upright. */
  overhang?: boolean
  /** Put an upright here and space the neighboring posts evenly up to it. */
  post?: boolean
}

type RailingPost = {
  height: number
  position: Vec3
}
type RailingSegment = {
  halfLength: number
  position: Vec3
  rotation: [number, number, number, number]
}

export default class RailingPath extends Curve<Vector3> {
  /** Horizontal gap between neighboring posts; each railing rounds its length to the nearest whole number of gaps, so every railing keeps nearly the same rhythm. */
  static readonly postSpacing = 2
  readonly distances = [0]
  /** Like `distances`, but measured on the ground plan, so posts on a slope stand as far apart as on the level. */
  readonly horizontalDistances = [0]
  readonly horizontalLength: number
  readonly length: number
  /** Rail centerline vertices; the capsule colliders and rendered tube both follow them exactly. */
  readonly points: Array<Vector3>
  readonly postRadius = 0.035
  readonly posts: Array<RailingPost>
  readonly radius = 0.04
  readonly segments: Array<RailingSegment>

  constructor(readonly anchors: Array<RailingAnchor>) {
    super()
    if (anchors.length < 2 || anchors.some(anchor => !anchor.ground.every(Number.isFinite) || !Number.isFinite(anchor.height) || anchor.height <= 0)) {
      throw new RangeError('A railing needs at least two finite anchors with positive heights.')
    }
    this.points = anchors.map((_, i) => this.top(i))
    for (let i = 1; i < anchors.length; i++) {
      const distance = this.points[i].distanceTo(this.points[i - 1])
      if (distance < 0.000001) {
        throw new RangeError('Consecutive railing anchors must be distinct.')
      }
      this.distances.push(this.distances[i - 1] + distance)
      this.horizontalDistances.push(this.horizontalDistances[i - 1] + Math.hypot(anchors[i].ground[0] - anchors[i - 1].ground[0], anchors[i].ground[2] - anchors[i - 1].ground[2]))
    }
    this.length = this.distances.at(-1)!
    this.horizontalLength = this.horizontalDistances.at(-1)!
    this.segments = anchors.slice(1).map((_, i) => {
      const a = this.points[i].clone()
      const b = this.points[i + 1]
      const direction = b.clone().sub(a)
      const rotation = new Quaternion
      rotation.setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())
      return {
        position: a.add(b).multiplyScalar(0.5).toArray(),
        rotation: rotation.toArray(),
        halfLength: direction.length() / 2,
      }
    })
    const first = anchors[0].overhang ? 1 : 0
    const last = anchors.length - (anchors.at(-1)!.overhang ? 2 : 1)
    let start = this.horizontalDistances[first]
    this.posts = [this.post(start / (this.horizontalLength || 1))]
    for (let i = first + 1; i <= last; i++) {
      if (!anchors[i].post && i !== last) {
        continue
      }
      const end = this.horizontalDistances[i]
      const span = end - start
      const gaps = Math.max(1, Math.round(span / RailingPath.postSpacing))
      for (let j = 1; j <= gaps; j++) {
        this.posts.push(this.post((start + span * j / gaps) / (this.horizontalLength || 1)))
      }
      start = end
    }
  }

  getPoint(t: number, target = new Vector3) {
    const {ground, height} = this.sample(t)
    return target.set(ground[0], ground[1] + height, ground[2])
  }

  /** The post standing at the given fraction of the railing’s horizontal length. */
  post(fraction: number): RailingPost {
    const {ground, height} = this.interpolate(this.horizontalDistances, clamp(fraction, 0, 1) * this.horizontalLength)
    return {
      position: [ground[0], ground[1] + height / 2, ground[2]],
      height,
    }
  }

  sample(t: number): RailingAnchor {
    return this.interpolate(this.distances, clamp(t, 0, 1) * this.length)
  }

  private interpolate(distances: Array<number>, distance: number): RailingAnchor {
    let low = 0
    let high = distances.length - 1
    while (low + 1 < high) {
      const mid = low + high >>> 1
      if (distances[mid] <= distance) {
        low = mid
      } else {
        high = mid
      }
    }
    const a = this.anchors[low]
    const b = this.anchors[high]
    // Anchors stacked straight above each other have no horizontal extent between them.
    const span = distances[high] - distances[low]
    const f = span > 0 ? (distance - distances[low]) / span : 0
    return {
      ground: a.ground.map((value, i) => value + (b.ground[i] - value) * f) as Vec3,
      height: a.height + (b.height - a.height) * f,
    }
  }

  private top(index: number) {
    const {ground, height} = this.anchors[index]
    return new Vector3(ground[0], ground[1] + height, ground[2])
  }
}
