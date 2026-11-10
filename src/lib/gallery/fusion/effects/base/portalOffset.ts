import type {PortalFrame} from '#src/lib/gallery/fusion/portalFrame.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'

/** where something is relative to a portal’s middle: along the wall to the right, up and out into the room, in meters */
export type PortalOffset = readonly [along: number, up: number, out: number]

/** The offset and the points `radius` away from it to either side along each of the portal’s axes, which hold something that big round it. */
export function around([along, up, out]: PortalOffset, radius: number): Array<PortalOffset> {
  return [[along, up, out], [along - radius, up, out], [along + radius, up, out], [along, up - radius, out], [along, up + radius, out], [along, up, out - radius], [along, up, out + radius]]
}

/** `steps` + 1 moments evenly from `from` to `to` seconds, both included, or none should `to` come before `from`. */
export function moments(from: number, to: number, steps: number) {
  return to < from ? [] : Array.from({length: steps + 1}, (_, step) => from + (to - from) * step / steps)
}

/** Where the offset from the middle of the portal of `frame` lies in the world. */
export function offsetPosition({center, normal, tangent}: PortalFrame, [along, up, out]: PortalOffset): Vec3 {
  return [center[0] + tangent[0] * along + normal[0] * out, center[1] + up, center[2] + tangent[2] * along + normal[2] * out]
}
