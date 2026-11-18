import type {Vec3} from 'math'
import type {Vector3Like} from 'three/webgpu'

/** World positions are tuples in the gallery model and xyz objects in the renderer and physics. */
type Point = Readonly<Vec3> | Vector3Like
const xyz = (point: Point): Vector3Like => {
  if ('x' in point) {
    return point
  }
  const [x, y, z] = point
  return {
    x,
    y,
    z,
  }
}
/** A rough walking distance in world space: add the horizontal legs and count elevation changes threefold to allow for stairs. */
export default function perceptualDistance(from: Point, to: Point) {
  const a = xyz(from)
  const b = xyz(to)
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + 3 * Math.abs(a.y - b.y)
}
