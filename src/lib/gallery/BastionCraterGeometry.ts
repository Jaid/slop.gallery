import type {BufferGeometry} from 'three/webgpu'

import {mulberry32} from 'math/random'
import {ExtrudeGeometry, Float32BufferAttribute, BufferGeometry as Geometry, IcosahedronGeometry, Matrix4, Shape, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {bastionCrater} from './bastion.ts'
import {pavingThickness} from './passages/RouteVaultGeometry.ts'

/** how many rings the rubble’s surface is laid in from its middle out to the broken edge */
const rings = 14
/** how far the rubble’s surface strays up or down from its bowl, at most, in meters */
const roughness = 0.03
/** how deep under the floor the rubble lies under the tipped flags, below the underside of the paving */
export const rubbleShelf = 0.28
/** how far out from the middle to the broken edge the rubble sinks into a pit, under the broken ends of the tipped flags */
const pit = 0.6
/** how far out from the middle to the broken edge the tipped flags broke off, at least and at most */
const breakShares = [0.66, 0.74] as const
/** how far under the floor the broken ends of the tipped flags hang, at least and at most: high enough over the rubble that an orb can’t roll up onto them, low enough that a player can step up */
const dropRange = [0.06, 0.1] as const
/** how thick the tipped flags are, at least and at most, which broke off the paving’s top */
const thicknessRange = [0.06, 0.09] as const
/** how far apart the tipped flags lie at their sides, along the broken edge */
const cracks = 0.015
/** the broken flags lying in the pit */
const shards = 10

/**
 * The Bastion’s crater, in its own frame with the floor’s level round its middle at the origin, inside the hole broken through the paving: the flags that tipped into it from its edge, the rubble under them that sinks into a pit down to its `depth` in its middle, and a few shards lying in the pit.
 * The hole itself, its broken edge included, is the curve’s pit, which its vault geometry breaks through its paving.
 */
export default class BastionCraterGeometry {
  /** how far under the floor each tipped flag’s broken end hangs, at the top of its lowest corner */
  readonly drops: ReadonlyArray<number>
  /** the flags that tipped into the crater from its edge, each hinged on the broken edge and broken off toward the middle */
  readonly flags: BufferGeometry
  readonly rubble: BufferGeometry
  readonly shards: BufferGeometry

  constructor() {
    const {center, depth, outline, radius} = bastionCrater
    const randomState = mulberry32.create(1871)
    const random = () => mulberry32.sample(randomState)
    const between = ([low, high]: readonly [number, number]) => low + random() * (high - low)
    const corners = outline.map(([x, z]) => new Vector2(x - center[0], z - center[2]))
    const count = corners.length
    /** how high the rubble lies `share` of the way out from its middle to the broken edge, before it settled unevenly: from the paving’s underside at the edge down to the shelf under the flags and into the pit */
    const bowl = (share: number) => {
      if (share > 0.9) {
        return -pavingThickness - (rubbleShelf - pavingThickness) * (1 - share) / 0.1
      }
      return -rubbleShelf - (depth - rubbleShelf) * Math.max(0, 1 - share / pit) ** 2
    }
    const positions = [0, -depth, 0]
    for (let ring = 1; ring <= rings; ring++) {
      const share = ring / rings
      for (const {x, y} of corners) {
        // Settled unevenly, but meeting the paving’s underside all along the edge.
        const stray = ring === rings ? 0 : (random() * 2 - 1) * roughness
        positions.push(x * share, bowl(share) + stray, y * share)
      }
    }
    const indices: Array<number> = []
    const at = (ring: number, corner: number) => (ring ? 1 + (ring - 1) * count + corner % count : 0)
    // The edge’s corners turn from east toward south, so these face up.
    for (let corner = 0; corner < count; corner++) {
      indices.push(0, at(1, corner + 1), at(1, corner))
      for (let ring = 1; ring < rings; ring++) {
        const [a, b, c, d] = [at(ring, corner), at(ring, corner + 1), at(ring + 1, corner), at(ring + 1, corner + 1)]
        indices.push(a, b, c, b, d, c)
      }
    }
    this.rubble = new Geometry
    this.rubble.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.rubble.setIndex(indices)
    this.rubble.computeVertexNormals()
    this.rubble.computeBoundingBox()
    this.rubble.computeBoundingSphere()
    // Round the edge, each flag spans two of its stretches, or three where the edge breaks unevenly; every corner is shared by the flags to either side.
    const spans: Array<[number, number]> = []
    for (let first = 0; first < count;) {
      const last = Math.min(count, first + (random() < 0.3 && count - first > 3 ? 3 : 2))
      spans.push([first, last])
      first = last
    }
    const drops: Array<number> = []
    const turn = new Matrix4
    const flags = spans.map(([first, last]) => {
      const outer = Array.from({length: last - first + 1}, (_, index) => corners[(first + index) % count].clone())
      const inner = outer.map(corner => corner.clone().multiplyScalar(between(breakShares)))
      // a crack apart from the flags to either side
      for (const side of [outer, inner]) {
        const [start, end] = [side[0], side.at(-1)!]
        const along = end.clone().sub(start).normalize().multiplyScalar(cracks / 2)
        start.add(along)
        end.sub(along)
      }
      const thickness = between(thicknessRange)
      // Drawn with its y turned to −z, it is extruded upward once it lies down, its top at the floor’s level.
      const flag = new ExtrudeGeometry(new Shape([...outer, ...inner.toReversed()].map(({x, y}) => new Vector2(x, -y))), {
        depth: thickness,
        bevelEnabled: false,
      })
      flag.rotateX(-Math.PI / 2).translate(0, -thickness, 0)
      // Tipped about a hinge along the chord across its ends, through its outermost corner, so that no corner rises over the floor, its broken end down by `drop`.
      const [start, end] = [outer[0], outer.at(-1)!]
      const axis = new Vector3(end.x - start.x, 0, end.y - start.y)
      axis.normalize()
      // how far out the corner lies, away from the middle on the right of the axis
      const out = (corner: Vector2) => corner.x * axis.z - corner.y * axis.x
      const hinge = outer.reduce((outermost, corner) => (out(corner) > out(outermost) ? corner : outermost))
      // The corner of its broken end furthest from the hinge drops by `drop`, the others less.
      const reach = Math.max(...inner.map(({x, y}) => Math.abs((x - hinge.x) * axis.z - (y - hinge.y) * axis.x)))
      const drop = between(dropRange)
      drops.push(drop)
      // Turning about the axis from start to end lowers what lies to its left, toward the middle, as the corners run.
      turn.makeRotationAxis(axis, Math.asin(drop / reach))
      return flag.translate(-hinge.x, 0, -hinge.y).applyMatrix4(turn).translate(hinge.x, 0, hinge.y)
    })
    this.drops = drops
    this.flags = mergeParts(flags)
    this.shards = mergeParts(Array.from({length: shards}, (_, shard) => {
      const angle = (shard + random() * 0.6) / shards * Math.PI * 2
      const share = 0.1 + random() * 0.3
      const thickness = 0.03 + random() * 0.02
      const piece = new IcosahedronGeometry(1, 0)
      // Bedded into the rubble, tilted as they fell.
      return piece.scale(0.09 + random() * 0.07, thickness, 0.07 + random() * 0.06).rotateX((random() - 0.5) * 0.2).rotateY(random() * Math.PI).translate(Math.cos(angle) * radius * share, bowl(share) - thickness * 0.2, Math.sin(angle) * radius * share)
    }))
  }

  dispose() {
    this.flags.dispose()
    this.rubble.dispose()
    this.shards.dispose()
  }
}
