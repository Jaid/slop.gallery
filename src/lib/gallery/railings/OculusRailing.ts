import type {Vec3} from '../types.ts'
import type {RailingAnchor} from './RailingPath.ts'

import {oculusRamps} from '../lowerGallery.ts'
import tower, {towerRamp as ramp, towerBridge, towerBridgeLift, towerBridges, towerDeck, towerNecks, towerRampHeight} from '../oculusTower.ts'
import RailingPath from './RailingPath.ts'

const inset = 0.12
/** How far short of a wall’s center line the last bridge upright stands. */
const wallGap = 0.3
/** Handrail past the last upright, tangent to the flared bridge mouth. */
const bridgeOverhang = 0.4
const count = towerDeck.length
const at = (index: number) => (index + count) % count
const deckY = ramp.endY
const fenceHeight = ramp.railHeight / 2
const along = (neck: number, [x, z]: readonly [number, number]) => x * Math.cos(towerNecks[neck].angle) + z * Math.sin(towerNecks[neck].angle)
const neckReach = towerNecks[0].reach
/** How far onto each bridge its rails reach full height. Their rise begins back on the deck, as the ramp rails start turning outward. */
export const bridgeRailRise = 1.5
const riseStart = ramp.width / 2 - inset
const riseEnd = neckReach + bridgeRailRise
/** the unit normal to the left of an edge of the deck’s outline, which runs counterclockwise, so it points into the deck */
const inward = (from: readonly [number, number], to: readonly [number, number]) => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1])
  return [-(to[1] - from[1]) / length, (to[0] - from[0]) / length] as const
}
/** The deck’s outline, every point moved `inset` meters inward along the bisector of its two edges. */
const insetOutline = towerDeck.map(({point}, i): readonly [number, number] => {
  const n1 = inward(towerDeck[at(i - 1)].point, point)
  const n2 = inward(point, towerDeck[at(i + 1)].point)
  const scale = inset / (1 + n1[0] * n2[0] + n1[1] * n2[1])
  return [point[0] + (n1[0] + n2[0]) * scale, point[1] + (n1[1] + n2[1]) * scale]
})
/** One height profile across the turn and the bridge keeps the handrail climbing gently through their join. */
const fenceAt = (localX: number) => {
  const t = Math.min(1, Math.max(0, (Math.abs(localX) - riseStart) / (riseEnd - riseStart)))
  return fenceHeight + (towerBridge.railHeight - fenceHeight) * t * t * (3 - 2 * t)
}
/** how far apart the rail’s points follow its climb */
const riseStep = 0.1
/** how close a point of the climb may come to one of the outline’s */
const minimumGap = 0.03
/** How far the floor under the rail has climbed along a bridge; the outline’s points along the bridge’s sides are close enough together to follow it. */
const liftAt = (neck: number, point: readonly [number, number]) => {
  const {wallDistance} = towerNecks[neck]
  return wallDistance === undefined ? 0 : towerBridgeLift(along(neck, point), wallDistance)
}
/** where a bridge’s rails stop short of its wall, along the bridge from the tower’s axis */
const railEnd = (neck: number) => towerBridges.find(bridge => bridge.angle === towerNecks[neck].angle)!.wallDistance - wallGap
const reachesWall = (neck: number, point: readonly [number, number]) => neck > 0 && along(neck, point) > railEnd(neck)
/**
 * The rail along the deck’s outline through the indices, in their order, inset from its edges; where it runs out along a bridge toward its wall, it stops short of the wall.
 */
const perimeter = (indices: ReadonlyArray<number>): Array<RailingAnchor> => {
  const anchors: Array<{
    neck: number
    point: readonly [number, number]
  }> = []
  for (const index of indices) {
    const {neck} = towerDeck[index]
    const point = insetOutline[index]
    const previous = anchors.at(-1)
    // Where a bridge’s straight side runs through the rail’s climb, points in between give the climb its shape.
    if (previous?.neck === neck && neck) {
      const [from, to] = [along(neck, previous.point), along(neck, point)]
      const steps = Math.round(bridgeRailRise / riseStep)
      // Not too close to the outline’s own points along the bridge, whose climb they follow too, so no segment of the rail is too short to turn its tube’s rings.
      const climb = Array.from({length: steps + 1}, (_, step) => neckReach + bridgeRailRise * step / steps).filter(value => value > Math.min(from, to) + minimumGap && value < Math.max(from, to) - minimumGap)
      for (const value of from < to ? climb : climb.toReversed()) {
        const t = (value - from) / (to - from)
        anchors.push({
          neck,
          point: [previous.point[0] + (point[0] - previous.point[0]) * t, previous.point[1] + (point[1] - previous.point[1]) * t],
        })
      }
    }
    anchors.push({
      neck,
      point,
    })
  }
  // Cut both ends where they come within the gap of a wall, exactly at the gap.
  const cut = (list: typeof anchors) => {
    const inside = list.findIndex(({neck, point}) => !reachesWall(neck, point))
    if (inside <= 0) {
      return list
    }
    const {neck, point: outer} = list[inside - 1]
    const {point: inner} = list[inside]
    const t = (railEnd(neck) - along(neck, inner)) / (along(neck, outer) - along(neck, inner))
    return [{
      neck,
      point: [inner[0] + (outer[0] - inner[0]) * t, inner[1] + (outer[1] - inner[1]) * t] as const,
    }, ...list.slice(inside)]
  }
  const path: Array<RailingAnchor> = cut(cut(anchors).toReversed()).toReversed().map(({neck, point}) => ({
    ground: [tower.x + point[0], deckY + liftAt(neck, point), tower.z + point[1]],
    height: fenceAt(point[0]),
  }))
  const tip = (end: RailingAnchor, previous: RailingAnchor): RailingAnchor => {
    const [x, y, z] = end.ground
    const dx = x - previous.ground[0]
    const dz = z - previous.ground[2]
    const scale = bridgeOverhang / Math.hypot(dx, dz)
    return {
      ground: [x + dx * scale, y, z + dz * scale],
      height: end.height,
      overhang: true,
    }
  }
  if (reachesWall(anchors[0].neck, anchors[0].point)) {
    path.unshift(tip(path[0], path[1]))
  }
  if (reachesWall(anchors.at(-1)!.neck, anchors.at(-1)!.point)) {
    path.push(tip(path.at(-1)!, path.at(-2)!))
  }
  return path
}
/** the deck’s indices from `from` to `to`, both included, forward or backward */
const indices = (from: number, to: number, step: -1 | 1) => {
  const result = [from]
  while (result.at(-1) !== to) {
    result.push(at(result.at(-1)! + step))
  }
  return result
}
/** the indices of a neck’s body, which runs from its left end over to its right end: a bridge’s out along its left side to the wall and back along its right side */
const neckIndices = (neck: number) => towerDeck.keys().filter(index => {
  const {neck: owner, shoulder, local} = towerDeck[index]
  return owner === neck && !shoulder && Math.hypot(...local) > tower.radius + 1e-6
}).toArray()
const [eastNeck, westNeck] = [1, 2].map(neckIndices)
/** where a bridge’s body crosses its wall: the last point of its left side and the first of its right side */
const wallEnds = (body: ReadonlyArray<number>) => [body[body.length / 2 - 1], body[body.length / 2]] as const
/** Up the west side ramp, along the platform and up the tower ramp, turning onto the west bridge. */
function westRamp() {
  const west = oculusRamps.find(value => value.side === 'west')!
  const left: Array<RailingAnchor> = []
  const add = (ground: Vec3, height = ramp.railHeight, post = false) => {
    const previous = left.at(-1)
    if (!previous || Math.hypot(...ground.map((value, i) => value - previous.ground[i])) > 0.00001 || height !== previous.height) {
      left.push({
        ground,
        height,
        post,
      })
    }
  }
  const lowerX = west.x + west.width / 2 - inset
  add([lowerX, west.floorY, west.startZ])
  add([lowerX, west.floorY + west.rise, west.startZ - west.run])
  // Round the turn onto the base without cutting across the opening beside the lower slope.
  for (let i = 1; i <= 12; i++) {
    const theta = Math.PI + i / 12 * Math.PI / 2
    add([lowerX + inset + Math.cos(theta) * inset, ramp.startY, ramp.startZ + Math.sin(theta) * inset], ramp.railHeight, i === 6)
  }
  const cornerX = tower.x - ramp.width / 2 - ramp.baseCornerRadius
  add([cornerX, ramp.startY, ramp.startZ - inset])
  // Follow the rounded base corner at a constant inset from its exposed edge.
  for (let i = 1; i <= 40; i++) {
    const theta = i / 40 * Math.PI / 2
    const z = ramp.startZ + ramp.baseCornerRadius - (ramp.baseCornerRadius + inset) * Math.cos(theta)
    add([cornerX + (ramp.baseCornerRadius + inset) * Math.sin(theta), towerRampHeight((z - ramp.startZ) / (ramp.endZ - ramp.startZ)), z])
  }
  // The sloped rail climbs until it reaches the tower fence’s level, easing into it with a smooth minimum instead of rising past it and dropping back.
  const fenceY = ramp.endY + fenceHeight
  const blend = 0.4
  const straightStart = ramp.startZ + ramp.baseCornerRadius
  // One quarter circle tangent to both straight rails. Start the turn just before the deck so it sweeps across the two stone shoulders in one bend.
  const turnReach = neckReach + 0.35
  const turnRadius = turnReach - (ramp.width / 2 - inset)
  const turnZ = tower.z - turnReach
  for (let i = 1; i <= 64; i++) {
    const z = straightStart + (turnZ - straightStart) * i / 64
    const groundY = towerRampHeight((z - ramp.startZ) / (ramp.endZ - ramp.startZ))
    const sloped = groundY + ramp.railHeight
    const overlap = Math.max(blend - Math.abs(sloped - fenceY), 0) / blend
    add([tower.x - ramp.width / 2 + inset, groundY, z], Math.min(sloped, fenceY) - overlap * overlap * blend / 4 - groundY)
  }
  for (let i = 1; i <= 24; i++) {
    const angle = i / 24 * Math.PI / 2
    const x = -turnReach + turnRadius * Math.cos(angle)
    const z = turnZ + turnRadius * Math.sin(angle)
    const point = [x, z - tower.z] as const
    const groundY = z < ramp.endZ ? towerRampHeight((z - ramp.startZ) / (ramp.endZ - ramp.startZ)) : deckY + liftAt(2, point)
    add([tower.x + x, groundY, z], fenceAt(x) + Math.max(0, deckY - groundY))
  }
  const bridge = perimeter(indices(westNeck.at(-1)!, wallEnds(westNeck)[1], -1))
  return [...left, ...bridge.filter(({ground}) => ground[0] < tower.x - turnReach - minimumGap)]
}

/**
 * The rails around the tower’s deck, its ramp and its bridges, in three open paths that leave the deck’s openings to the ramp and to the walls clear:
 * the west one runs up the west side ramp, the tower’s ramp and round the deck’s north-west quarter onto the west bridge’s north side, the east one likewise on the east, and the south one along both bridges’ south sides and round the deck’s south half between them.
 */
export default class OculusRailing extends RailingPath {
  constructor(readonly run: 'east' | 'south' | 'west') {
    if (run === 'south') {
      super(perimeter(indices(wallEnds(eastNeck)[1], wallEnds(westNeck)[0], 1)))
      return
    }
    const west = westRamp()
    // The east is the west’s mirror image, run from its far end.
    super(run === 'west' ? west : west.map(({ground: [x, y, z], ...anchor}): RailingAnchor => ({
      ground: [2 * tower.x - x, y, z],
      ...anchor,
    })).toReversed())
  }
}
