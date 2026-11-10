/** a point or a direction, shaped like Rapier’s and three’s vectors */
export type Vector = {
  x: number
  y: number
  z: number
}
/** a unit quaternion, shaped like Rapier’s and three’s */
export type Rotation = Vector & {
  w: number
}

export const makeVector = (): Vector => ({
  x: 0,
  y: 0,
  z: 0,
})

export const makeRotation = (): Rotation => ({
  x: 0,
  y: 0,
  z: 0,
  w: 1,
})

/** Copies `from` into `target`, which also takes a rotation into a rotation. */
export function copy<Target extends Vector>(target: Target, from: Readonly<Target>) {
  return Object.assign(target, from)
}

export const dot = (a: Readonly<Vector>, b: Readonly<Vector>) => a.x * b.x + a.y * b.y + a.z * b.z

/** `a` × `b` into `target`, which may be either of them. */
export function cross(target: Vector, a: Readonly<Vector>, b: Readonly<Vector>) {
  const x = a.y * b.z - a.z * b.y
  const y = a.z * b.x - a.x * b.z
  target.z = a.x * b.y - a.y * b.x
  target.x = x
  target.y = y
  return target
}

/** `vector` turned by `rotation` into `target`, which may be the vector itself. */
export function rotate(target: Vector, vector: Readonly<Vector>, rotation: Readonly<Rotation>) {
  const {x, y, z} = vector
  // v + 2w (q × v) + 2 q × (q × v)
  const tx = 2 * (rotation.y * z - rotation.z * y)
  const ty = 2 * (rotation.z * x - rotation.x * z)
  const tz = 2 * (rotation.x * y - rotation.y * x)
  target.x = x + rotation.w * tx + rotation.y * tz - rotation.z * ty
  target.y = y + rotation.w * ty + rotation.z * tx - rotation.x * tz
  target.z = z + rotation.w * tz + rotation.x * ty - rotation.y * tx
  return target
}

/** The rotation that turns by `b` first and by `a` then, into `target`, which may be either of them. */
export function multiply(target: Rotation, a: Readonly<Rotation>, b: Readonly<Rotation>) {
  const x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y
  const y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z
  const z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x
  target.w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  target.x = x
  target.y = y
  target.z = z
  return target
}

/** The rotation that turns `rotation` back, into `target`, which may be the rotation itself. */
export function invert(target: Rotation, rotation: Readonly<Rotation>) {
  target.x = -rotation.x
  target.y = -rotation.y
  target.z = -rotation.z
  target.w = rotation.w
  return target
}
