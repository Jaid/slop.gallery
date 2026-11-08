import type {Portrait, Vec3} from '../types.ts'

import {clamp} from 'math'

/** where a fusion’s portal floats in front of its work and how the work and what was thrown into it orbit around it */
export type PortalFrame = {
  center: Vec3
  /** the floor’s height under the portal */
  floor: number
  /** horizontal, out of the wall */
  normal: Vec3
  /** the semi-axes of the orbit: along the wall and across it, and how much higher than the portal it passes on the wall’s side, as much lower on the room’s */
  orbit: {
    across: number
    along: number
    tilt: number
  }
  /** of the portal’s glowing disc */
  radius: number
  /** horizontal, along the wall, to the right of someone facing it */
  tangent: Vec3
}
/** how much free room surrounds the work, in meters, as far as the world knows */
export type PortalSurroundings = {
  /** the floor’s height under the work */
  floor: number
  /** how far the room reaches out from the work, along its normal */
  room: number
  /** how far the wall reaches to either side of the portal before another one stands in the way */
  sides: readonly [left: number, right: number]
}

/** an upright capsule, like the player’s body */
export type UprightCapsule = {
  /** its middle */
  center: Vec3
  /** from its bottom to its top */
  height: number
  radius: number
}

/** the largest side an orbiting work shrinks to, in meters */
export const satelliteSize = 0.8
/** the radius of the portal’s glowing disc, in meters */
export const portalRadius = 0.42
/** how much room an orbiting work keeps from the wall behind it and the ones to the sides, in meters */
const clearance = satelliteSize / 2 + 0.12
/** how a portal the player breaks off throws the body back, in m/s: along the ground as fast as it came, but no slower than `least` and no faster than `most`, and up by `lift` */
const rebound = {
  least: 5,
  lift: 3,
  most: 8,
}
/** how far out from the work the room’s sides are measured, clear of the work’s own wall */
const sideProbe = 0.3

/** The portal that opens in front of the work in `world`, sized to the room around it, see {@link portalFrame}. */
export function portalIn(work: Pick<Portrait, 'position' | 'rotation'>, world: {
  floorHeight: (position: Vec3) => number
  wallDistance: (origin: Vec3, direction: Vec3) => number
}) {
  const {position, rotation} = work
  const normal: Vec3 = [Math.sin(rotation), 0, Math.cos(rotation)]
  const tangent: Vec3 = [normal[2], 0, -normal[0]]
  const probe: Vec3 = [position[0] + normal[0] * sideProbe, position[1], position[2] + normal[2] * sideProbe]
  return portalFrame(work, {
    floor: world.floorHeight(position),
    room: world.wallDistance(position, normal),
    sides: [world.wallDistance(probe, [-tangent[0], 0, -tangent[2]]), world.wallDistance(probe, tangent)],
  })
}

/** The portal opens in front of the work at about eye height, as far out as the room lets its orbit pass clear of the wall. */
export function portalFrame(work: Pick<Portrait, 'position' | 'rotation'>, {floor, room, sides}: PortalSurroundings): PortalFrame {
  const normal: Vec3 = [Math.sin(work.rotation), 0, Math.cos(work.rotation)]
  const tangent: Vec3 = [normal[2], 0, -normal[0]]
  const distance = clamp(room * 0.45, 0.95, 1.45)
  const height = clamp(work.position[1], floor + 1.55, floor + 2.05)
  return {
    center: [work.position[0] + normal[0] * distance, height, work.position[2] + normal[2] * distance],
    floor,
    normal,
    tangent,
    radius: portalRadius,
    orbit: {
      along: clamp(Math.min(...sides) - clearance, 0.85, 1.35),
      across: clamp(distance - clearance, 0.35, 0.8),
      // Steep enough that the satellites pass under the portal in front of it and over it behind it, rather than across it.
      tilt: 0.72,
    },
  }
}

/**
 * The velocity in m/s that a portal the player breaks off by jumping into it throws the body back with: back the way it came along the ground, as fast as it came, within bounds, and up with a hop.
 * The slower it came across, the more it is thrown out away from the portal’s middle instead, or into the room right under it.
 */
export function portalRebound(frame: PortalFrame, {center, velocity}: {
  center: Vec3
  /** in m/s */
  velocity: Vec3
}): Vec3 {
  const outX = center[0] - frame.center[0]
  const outZ = center[2] - frame.center[2]
  const out = Math.hypot(outX, outZ)
  // As if it also came at 1 m/s straight at the portal’s middle, which barely steers a jump but decides for a body that rose straight into it.
  let x = -velocity[0] + (out > 0.01 ? outX / out : 0)
  let z = -velocity[2] + (out > 0.01 ? outZ / out : 0)
  let length = Math.hypot(x, z)
  if (length < 0.01) {
    x = frame.normal[0]
    z = frame.normal[2]
    length = 1
  }
  const speed = clamp(Math.hypot(velocity[0], velocity[2]), rebound.least, rebound.most)
  return [x / length * speed, rebound.lift, z / length * speed]
}

/** Whether the capsule reaches into the portal’s disc, which faces the camera and so counts as a ball. */
export function touchesPortal(frame: PortalFrame, {center, height, radius}: UprightCapsule) {
  const half = Math.max(0, height / 2 - radius)
  const nearest = clamp(frame.center[1], center[1] - half, center[1] + half)
  return Math.hypot(frame.center[0] - center[0], frame.center[1] - nearest, frame.center[2] - center[2]) < frame.radius + radius
}
