/** a 3D point as a tuple `[x, y, z]` or an object `{x, y, z}` */
export type Point3 = readonly [number, number, number] | {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * Rough perceptual / walking distance between two 3D points in meters: horizontal Manhattan distance plus three times the vertical difference, which approximates walking through orthogonal rooms and penalizes climbing or dropping across floors without a square root.
 */
export default function perceptualDistance(a: Point3, b: Point3) {
  const ax = 'x' in a ? a.x : a[0]
  const ay = 'x' in a ? a.y : a[1]
  const az = 'x' in a ? a.z : a[2]
  const bx = 'x' in b ? b.x : b[0]
  const by = 'x' in b ? b.y : b[1]
  const bz = 'x' in b ? b.z : b[2]
  return Math.abs(ax - bx) + Math.abs(az - bz) + 3 * Math.abs(ay - by)
}
