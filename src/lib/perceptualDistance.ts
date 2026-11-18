import type {Vec3} from 'math'

/** A rough walking distance: sum the horizontal offsets and charge three times as much for elevation changes, without tracing a route. */
export function perceptualDistance(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2]) + 3 * Math.abs(a[1] - b[1])
}
