import {clamp} from 'math'

import {wallFace} from './architectureDimensions.ts'
import easedRamp, {easedRampGradient, easedRampKnots} from './easedRamp.ts'
import lobby from './lobby.ts'
import lowerGallery, {oculusDrop, oculusPlatform, oculusTowerRadius} from './lowerGallery.ts'

type Point = readonly [x: number, z: number]

const oculusTower = {
  x: lobby.opening.center[0],
  z: lobby.opening.center[1],
  radius: oculusTowerRadius,
  // Half a meter over the Lodge’s floor, low enough for the Bastion to reach its east bridge under the Salon’s floor.
  height: 3.5 + oculusDrop,
  floorY: lowerGallery.oculus.floorY,
}
const startZ = oculusPlatform.position[2] + oculusPlatform.size[2] / 2
const endZ = oculusTower.z - oculusTower.radius - 0.1
const startY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
const endY = oculusTower.floorY + oculusTower.height
export const towerRamp = {
  startZ,
  endZ,
  startY,
  endY,
  width: 1.8,
  baseCornerRadius: 1.1,
  segments: 64,
  railHeight: 1,
}
// The lower jamb lies flush with the base’s flat front face, so no sliver of the rounded fillets is left standing beside the
// opening; the taller end reaches the circular tower’s rear edge, where the round tower itself closes the passage.
const archStartZ = startZ
const archEndZ = oculusTower.z - oculusTower.radius
export const towerArch = {
  z: (archStartZ + archEndZ) / 2,
  width: archEndZ - archStartZ,
  // a meter under the deck
  height: oculusTower.height - 1,
  // low enough that more than 50 cm of stone stays between the rounded corner and the ramp’s deck above it
  lowHeight: startY - oculusTower.floorY - 0.6,
  cornerRadius: 0.7,
  // where the roof rounds down into the round tower behind the bridge’s end
  highCornerRadius: 0.6,
}
/** The bridges from the deck to the side walls, as wide as the ramp, climbing gently toward their walls and widening there into the doorways they lead to with fillets like the ramp’s base. */
export const towerBridge = {
  width: towerRamp.width,
  flareRadius: towerRamp.baseCornerRadius,
  /** how deep their slabs reach under their floors */
  thickness: 0.4,
  railHeight: 1,
  /** how wide they are where they meet their walls, the width of the doorways they lead to */
  mouthWidth: towerRamp.width + towerRamp.baseCornerRadius * 2,
  /** how far they climb from the deck to their walls, easing in and out like the ramp */
  rise: 0.6,
}
/** the west bridge leads into the Bastion’s western climb and the east one into its mouth */
export const towerBridges = (['west', 'east'] as const).map(side => ({
  side,
  /** the direction it leaves the tower in, as an angle in the floor plan, atan2 of z and x */
  angle: side === 'east' ? 0 : Math.PI,
  /** the center line of the wall it meets, as the distance from the tower’s axis */
  wallDistance: lowerGallery.oculus.size[0] / 2 + (side === 'east' ? 1 : -1) * (lowerGallery.oculus.center[0] - oculusTower.x),
}))

const easedHeight = (t: number) => startY + t * t * (3 - 2 * t) * (endY - startY)

// Rendering, railings and navigation use the same gently eased longitudinal profile.
export function towerRampHeight(fraction: number) {
  const segment = clamp(fraction, 0, 1) * towerRamp.segments
  const index = Math.floor(segment)
  const t = segment - index
  return easedHeight(index / towerRamp.segments) * (1 - t) + easedHeight(Math.min(index + 1, towerRamp.segments) / towerRamp.segments) * t
}
export function towerRampGradient(fraction: number) {
  return 6 * fraction * (1 - fraction) * (endY - startY) / (endZ - startZ)
}

// Quarter-circle fillets meet the base’s front face and the straight ramp sides tangentially.
export function towerRampHalfWidth(z: number) {
  const radius = towerRamp.baseCornerRadius
  const distance = clamp(z - startZ, 0, radius)
  return towerRamp.width / 2 + radius - Math.sqrt(Math.max(0, radius * radius - (radius - distance) ** 2))
}

// Add angular samples near the base, where uniform longitudinal sampling would
// leave a visibly coarse first chord in the rounded corner.
export const towerRampSections = [
  ...new Set([
    ...Array.from({length: towerRamp.segments + 1}, (_, i) => startZ + (endZ - startZ) * i / towerRamp.segments),
    ...Array.from({length: 33}, (_, i) => startZ + towerRamp.baseCornerRadius * (1 - Math.cos(i / 32 * Math.PI / 2))),
  ]),
].toSorted((a, b) => a - b)

/**
 * Where the deck meets the ramp or a bridge: in the neck’s own frame, `along` points out of the tower in its direction and `across` to the right of that.
 * Its body is the deck’s outline beyond its shoulders, from its left end over to its right end: the ramp’s end, or a bridge out to its wall and back.
 */
export type TowerNeck = {
  angle: number
  body: ReadonlyArray<NeckPoint>
  halfWidth: number
  /** where the shoulders meet the body, as the distance from the tower’s axis */
  reach: number
  /** a bridge’s: the center line of the wall it leads to, as the distance from the tower’s axis */
  wallDistance?: number
}
/** a point of the deck’s outline relative to the tower’s axis, with the neck it belongs to: for points on the round wall, the nearest one */
export type DeckPoint = {
  corner?: 'after' | 'before'
  /** how far its floor lies over the deck: along a bridge, as far as the bridge has climbed */
  lift: number
  /** where it lies in its neck’s frame */
  local: readonly [along: number, across: number]
  neck: number
  point: Point
  /** whether it is part of a shoulder, which eases below the deck onto the round wall or the bridge’s side */
  shoulder: boolean
  /** where it eases to below the deck’s rim: a shoulder’s points onto the round wall, or onto the side of the ramp or bridge where that stands in front of it; every other point stays where it is */
  target: Point
}
/** a point of a neck’s outline in its own frame, a sharp corner telling which side of it shows: the outline before it or the one after it */
type NeckPoint = readonly [along: number, across: number, corner?: 'after' | 'before']

/** how far from a neck’s middle its shoulders meet the round wall, short of halfway to the next neck */
const shoulderAngle = 40 * Math.PI / 180
const neckHalfWidth = towerRamp.width / 2
/** where the ramp ends, a little beyond the round wall */
const neckReach = oculusTower.z - endZ
/** Sample the round wall about every 10 cm along its rim. */
const arcStep = 0.1 / oculusTower.radius
const flareSteps = 12
/** how long a bridge’s climb is, from the deck’s shoulders to where its fillets begin to flare out into the doorway in its wall */
const climbLength = (wallDistance: number) => wallDistance - wallFace - towerBridge.flareRadius - neckReach
/**
 * How far a bridge’s floor lies over the deck `along` meters out from the tower’s axis: level along the deck’s shoulders, then easing up like the ramp to its full rise, which its flared end keeps up to its wall.
 * The points along the bridge’s sides lie at the eased profile’s knots, so rendering, collision and navigation share it.
 */
export function towerBridgeLift(along: number, wallDistance: number) {
  return easedRamp(along - neckReach, climbLength(wallDistance)) * towerBridge.rise
}
/** How steeply a bridge’s floor climbs `along` meters out from the tower’s axis, in meters per meter along it. */
export function towerBridgeGradient(along: number, wallDistance: number) {
  return easedRampGradient(along - neckReach, climbLength(wallDistance)) * towerBridge.rise
}
/** The bridge’s body: out along its left side, round its left fillet onto the wall’s face, into the wall and across to the right, and back. */
const bridgeBody = (wallDistance: number): Array<NeckPoint> => {
  const radius = towerBridge.flareRadius
  // The fillets meet the plaster’s face, past which the deck reaches on into the wall.
  const face = wallDistance - wallFace
  const mouth = neckHalfWidth + radius
  const left: Array<NeckPoint> = [
    // Its side runs straight to the fillet, through the knots of its climb.
    ...easedRampKnots(climbLength(wallDistance)).slice(0, -1).map((knot): NeckPoint => [neckReach + knot, -neckHalfWidth]),
    ...Array.from({length: flareSteps + 1}, (_, i): NeckPoint => {
      const angle = i / flareSteps * Math.PI / 2
      return [face - radius + Math.sin(angle) * radius, -mouth + Math.cos(angle) * radius, i === flareSteps ? 'before' : undefined]
    }),
    [wallDistance, -mouth],
  ]
  const right = left.map(([along, across, corner]): NeckPoint => [along, -across, corner && (corner === 'before' ? 'after' : 'before')]).toReversed()
  return [...left, ...right]
}
/** the necks in the order they leave the tower, by their angle: the ramp from the north platform, the east bridge and the west bridge */
export const towerNecks: ReadonlyArray<TowerNeck> = [
  {
    angle: -Math.PI / 2,
    halfWidth: neckHalfWidth,
    reach: neckReach,
    // Its ends are the shoulders’ corners; the ramp abuts its face.
    body: [-1, -0.5, 0, 0.5, 1].map((across, i, list): NeckPoint => [neckReach, across * neckHalfWidth, i === 0 ? 'before' : (i === list.length - 1 ? 'after' : undefined)]),
  },
  ...towerBridges.toReversed().map((bridge): TowerNeck => ({
    angle: bridge.angle,
    halfWidth: neckHalfWidth,
    reach: neckReach,
    body: bridgeBody(bridge.wallDistance),
    wallDistance: bridge.wallDistance,
  })),
]

const cubic = (a: number, b: number, c: number, d: number, t: number) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d
/** The right shoulder in a neck’s frame, from the end of its side to the round wall: tangent to both, it replaces a rectangular landing’s corner. */
const shoulder = Array.from({length: 17}, (_, i): readonly [number, number] => {
  const t = i / 16
  const joinAlong = Math.cos(shoulderAngle) * oculusTower.radius
  const joinAcross = Math.sin(shoulderAngle) * oculusTower.radius
  return [
    cubic(neckReach, neckReach - 0.25, joinAlong + Math.sin(shoulderAngle) * 0.25, joinAlong, t),
    cubic(neckHalfWidth, neckHalfWidth, joinAcross - Math.cos(shoulderAngle) * 0.25, joinAcross, t),
  ]
})
// A point exactly where the side meets the round wall keeps the shoulder’s underside from overhanging it.
const cornerAlong = Math.sqrt(oculusTower.radius ** 2 - neckHalfWidth ** 2)
const crossing = shoulder.findIndex(([along]) => along < cornerAlong)
const [[along0, across0], [along1, across1]] = [shoulder[crossing - 1], shoulder[crossing]]
const shoulderPoints = shoulder.slice(1).toSpliced(crossing - 1, 0, [cornerAlong, across0 + (across1 - across0) * (cornerAlong - along0) / (along1 - along0)])
const toDeck = (neck: TowerNeck, along: number, across: number): Point => [
  along * Math.cos(neck.angle) - across * Math.sin(neck.angle),
  along * Math.sin(neck.angle) + across * Math.cos(neck.angle),
]
/** the angle from `from` round to `to` in the direction the outline runs, between 0 and a full turn */
const turn = (from: number, to: number) => ((to - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)

/**
 * The deck’s outline relative to the tower’s axis, around the tower in the direction of growing angles, starting at the ramp’s left end: each neck’s body, its right shoulder, the round wall up to the next neck and that neck’s left shoulder.
 * Tangent shoulders replace the rectangular landings’ corners. The outline is shared with point containment, so there are no invisible square ledges.
 */
export const towerDeck: ReadonlyArray<DeckPoint> = towerNecks.flatMap((neck, index) => {
  const nextIndex = (index + 1) % towerNecks.length
  const next = towerNecks[nextIndex]
  const vertex = (owner: number, local: readonly [number, number], extra: Partial<DeckPoint> = {}): DeckPoint => {
    const point = toDeck(towerNecks[owner], ...local)
    const [along, across] = local
    const reach = Math.max(neckHalfWidth, Math.sqrt(Math.max(0, oculusTower.radius ** 2 - along ** 2)))
    const {wallDistance} = towerNecks[owner]
    return {
      point,
      neck: owner,
      local,
      lift: wallDistance === undefined ? 0 : towerBridgeLift(along, wallDistance),
      shoulder: false,
      target: extra.shoulder ? toDeck(towerNecks[owner], along, Math.sign(across) * Math.min(Math.abs(across), reach)) : point,
      ...extra,
    }
  }
  const from = neck.angle + shoulderAngle
  const span = turn(from, next.angle - shoulderAngle)
  const steps = Math.max(2, Math.round(span / arcStep))
  return [
    ...neck.body.map(([along, across, corner]) => vertex(index, [along, across], corner ? {corner} : {})),
    ...shoulderPoints.map(local => vertex(index, local, {shoulder: true})),
    ...Array.from({length: steps - 1}, (_, i) => {
      const angle = from + span * (i + 1) / steps
      const owner = i + 1 < steps / 2 ? index : nextIndex
      const owned = towerNecks[owner]
      const relative = angle - owned.angle
      return vertex(owner, [Math.cos(relative) * oculusTower.radius, Math.sin(relative) * oculusTower.radius])
    }),
    ...shoulderPoints.toReversed().map(([along, across]) => vertex(nextIndex, [along, -across], {shoulder: true})),
  ]
})
export const towerPlatformOutline: ReadonlyArray<Point> = towerDeck.map(({point}) => point)

export function towerFloorHeight(x: number, z: number) {
  const localX = x - oculusTower.x
  const localZ = z - oculusTower.z
  let inside = false
  for (let i = 0, j = towerPlatformOutline.length - 1; i < towerPlatformOutline.length; j = i++) {
    const a = towerPlatformOutline[i]
    const b = towerPlatformOutline[j]
    if (a[1] > localZ !== b[1] > localZ && localX < (b[0] - a[0]) * (localZ - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside
    }
  }
  if (inside) {
    return endY + Math.max(...towerBridges.map(({angle, wallDistance}) => towerBridgeLift(localX * Math.cos(angle) + localZ * Math.sin(angle), wallDistance)))
  }
  if (Math.abs(localX) <= towerRampHalfWidth(z) && z >= startZ && z <= endZ) {
    return towerRampHeight((z - startZ) / (endZ - startZ))
  }
}

export default oculusTower
