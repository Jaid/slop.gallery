import type {Vec3} from 'math'

/** a point by its coordinates, the way three’s `Vector3` holds them */
export type Coordinates = Readonly<{
  x: number
  y: number
  z: number
}>
/** a point in world meters, as a tuple or by its coordinates */
export type Point = Coordinates | Readonly<Vec3>
/** a box aligned with the world axes, like three’s `Box3`; an empty one, whose minimum lies above its maximum, is infinitely far from everything */
export type Bounds = Readonly<{
  max: Coordinates
  min: Coordinates
}>

/** how many meters across the floor one meter up or down counts as: the gallery’s stairs climb 15 cm per 40 cm of going, which their landings and turns stretch to about 3 m per meter of height */
export const verticalWeight = 3

const isTuple = (point: Point): point is Readonly<Vec3> => Array.isArray(point)
const x = (point: Point) => (isTuple(point) ? point[0] : point.x)
const y = (point: Point) => (isTuple(point) ? point[1] : point.y)
const z = (point: Point) => (isTuple(point) ? point[2] : point.z)
/** how far apart are two points that are `dx`, `dy` and `dz` apart along the axes */
const span = (dx: number, dy: number, dz: number) => Math.abs(dx) + Math.abs(dz) + verticalWeight * Math.abs(dy)

/**
 * A quick, rough estimate of how far apart two points feel for someone walking from one to the other, in meters: the distance along x plus the one along z, as if walking along a grid of corridors, plus {@link verticalWeight} times the height between them, since getting up or down takes stairs or ramps.
 * It knows nothing about walls and openings. It suits ranking things by how soon the player might get to them, not finding a way.
 */
export function perceptualDistance(a: Point, b: Point) {
  return span(x(a) - x(b), y(a) - y(b), z(a) - z(b))
}

/** The {@link perceptualDistance} from the point to the nearest point of the box: 0 inside it and Infinity for an empty box. */
export function perceptualDistanceToBox(point: Point, {min, max}: Bounds) {
  if (min.x > max.x || min.y > max.y || min.z > max.z) {
    return Number.POSITIVE_INFINITY
  }
  const px = x(point)
  const py = y(point)
  const pz = z(point)
  return span(Math.max(min.x - px, 0, px - max.x), Math.max(min.y - py, 0, py - max.y), Math.max(min.z - pz, 0, pz - max.z))
}
