import type {Vec3} from '../gallery/types.ts'

/** the physics’ gravity, Rapier’s default, in m/s² downward */
export const gravity = 9.81

/**
 * The velocity that sends a body leaving `from` at `speed` m/s through `target` on the flatter of its two arcs, and the seconds it takes to get there, or undefined where it falls short at that speed.
 * The arc is a parabola; Rapier’s steps drop the body a few millimeters lower per meter flown.
 */
export function aimThrow(from: Vec3, target: Vec3, speed: number): {
  seconds: number
  velocity: Vec3
} | undefined {
  const [x, y, z] = target.map((value, axis) => value - from[axis])
  const reach = Math.hypot(x, z)
  const square = speed ** 2
  if (reach < 1e-6) {
    // Straight up or down: up only as far as the speed carries it.
    const discriminant = square - 2 * gravity * y
    if (discriminant < 0) {
      return
    }
    const upward = y >= 0
    return {
      seconds: upward ? (speed - Math.sqrt(discriminant)) / gravity : (Math.sqrt(discriminant) - speed) / gravity,
      velocity: [0, upward ? speed : -speed, 0],
    }
  }
  const discriminant = square ** 2 - gravity * (gravity * reach ** 2 + 2 * y * square)
  if (discriminant < 0) {
    return
  }
  const elevation = Math.atan2(square - Math.sqrt(discriminant), gravity * reach)
  const horizontal = speed * Math.cos(elevation)
  return {
    seconds: reach / horizontal,
    velocity: [x / reach * horizontal, speed * Math.sin(elevation), z / reach * horizontal],
  }
}

/** Where a body thrown from `from` with `velocity` is `seconds` later, on its parabola. */
export const flightPoint = (from: Vec3, velocity: Vec3, seconds: number): Vec3 => [from[0] + velocity[0] * seconds, from[1] + velocity[1] * seconds - gravity / 2 * seconds ** 2, from[2] + velocity[2] * seconds]
