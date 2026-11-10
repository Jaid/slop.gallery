import type {Vec3} from '#src/lib/gallery/types.ts'

/**
 * where a party effect plays: the point it bursts out of, its origin, like the middle of a fusion’s portal or the muzzle of the alchemy machine’s cannon, and the level directions it faces
 *
 * Effects call the upright plane through the origin that it faces out of its wall, whether or not one stands there.
 */
export type PartySite = {
  /** its origin, in world meters */
  center: Vec3
  /** the floor’s height under it, in the world */
  floor: number
  /** level, the way it faces: out of the wall behind it, into the room */
  normal: Vec3
  /** level, to the right of someone facing it */
  tangent: Vec3
}
/** where to play a party effect, as whoever spawns one gives it */
export type PartyPlacement = {
  /** the floor’s height under it, in the world, which what it spills lands on; the floor the world has there if left out */
  floor?: number
  /** the point it bursts out of, in world meters */
  position: Vec3
  /** the way it faces, as a turn around y in radians: toward +z at 0 and toward +x at a quarter turn, like a work on a wall */
  rotation?: number
}
/** how to play a party effect that is spawned on its own */
export type PartyOptions = {
  /** seconds until it bursts out, which it waits staged, drawing nothing yet, so its pipelines compile meanwhile; right away by default */
  delay?: number
}
/** where something is relative to a site’s center: to the right of someone facing it, up and out the way it faces, in meters */
export type PartyOffset = readonly [along: number, up: number, out: number]

/** The site at the placement, over the floor at `floor` unless the placement names its own. */
export function partySite({floor: ownFloor, position, rotation = 0}: PartyPlacement, floor: number): PartySite {
  const normal: Vec3 = [Math.sin(rotation), 0, Math.cos(rotation)]
  return {
    center: [...position],
    floor: ownFloor ?? floor,
    normal,
    tangent: [normal[2], 0, -normal[0]],
  }
}

/** The offset and the points `radius` away from it to either side along each of the site’s axes, which hold something that big round it. */
export function around([along, up, out]: PartyOffset, radius: number): Array<PartyOffset> {
  return [[along, up, out], [along - radius, up, out], [along + radius, up, out], [along, up - radius, out], [along, up + radius, out], [along, up, out - radius], [along, up, out + radius]]
}

/** `steps` + 1 moments evenly from `from` to `to` seconds, both included, or none should `to` come before `from`. */
export function moments(from: number, to: number, steps: number) {
  return to < from ? [] : Array.from({length: steps + 1}, (_, step) => from + (to - from) * step / steps)
}

/** Where the offset from the center of `site` lies in the world. */
export function offsetPosition({center, normal, tangent}: PartySite, [along, up, out]: PartyOffset): Vec3 {
  return [center[0] + tangent[0] * along + normal[0] * out, center[1] + up, center[2] + tangent[2] * along + normal[2] * out]
}
