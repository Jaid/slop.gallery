import {Vector3} from 'three/webgpu'

/** the box around an object’s origin that holds all of it, in meters */
export type StudioSubjectSize = {
  /** along its z, toward the viewer */
  depth: number
  height: number
  width: number
}

/** the vertical field of view of a studio’s camera on its stage in degrees, long enough to keep what is close to it from looking distorted, like the snapshots’ */
export const studioFov = 35
/** how much of the tighter side of the view an object fills at most from where the camera stands unless the player moves it closer or away */
export const viewFill = 0.86
/** how far the camera stays from the box around an object at least, as a share of the radius of the sphere around it */
export const clearance = 0.1

const worldUp = new Vector3(0, 1, 0)
const right = new Vector3
const up = new Vector3
const halves = [-0.5, 0.5] as const

/** The radius of the sphere around an object’s origin that holds all of it. */
export const subjectRadius = ({depth, height, width}: StudioSubjectSize) => Math.hypot(width, height, depth) / 2

/**
 * How far from the middle of an object of the size a camera stands that looks at that middle from the direction, a unit vector from the middle, for all of the box around the object to lie within {@link viewFill} of a view `aspect` times as wide as it is high, at the vertical field of view `fov` in degrees: as close as that allows, so the corner that reaches farthest touches that part’s edge.
 * From straight in front, that is where the object’s front fills the view’s tighter side; turned, the camera backs off as far as the corners coming toward it take, so nothing of the object ever leaves the view by turning it.
 * Framing the sphere around the object instead would leave something flat, like a framed work, small in the view for the sake of its diagonal, which only shows edge-on.
 */
export function fitDistance({depth, height, width}: StudioSubjectSize, direction: Vector3, aspect: number, fov = studioFov) {
  // The camera’s axes while it looks at the middle from there, as `Matrix4.lookAt` lays them out.
  right.crossVectors(worldUp, direction)
  if (right.lengthSq() < 1e-12) {
    right.set(1, 0, 0)
  }
  right.normalize()
  up.crossVectors(direction, right)
  const slope = Math.tan(fov * Math.PI / 360) * viewFill
  let distance = 0
  for (const sideX of halves) {
    for (const sideY of halves) {
      for (const sideZ of halves) {
        const x = sideX * width
        const y = sideY * height
        const z = sideZ * depth
        // A corner this much nearer than the middle, this far off the view’s axis.
        const toward = x * direction.x + y * direction.y + z * direction.z
        const sideways = Math.abs(x * right.x + y * right.y + z * right.z)
        const upward = Math.abs(x * up.x + y * up.y + z * up.z)
        distance = Math.max(distance, toward + Math.max(sideways / aspect, upward) / slope)
      }
    }
  }
  return distance
}

/**
 * How far from the middle of an object of the size a camera looking at that middle stays at least in each direction, a unit vector from the middle, to keep all of the box around the object in front of it, {@link clearance} away: no nearer than the plane that touches the box from that side.
 * So the camera never gets into the object however it is turned, and nothing of it is cut off by a near plane closer than that, while a flat object can still be looked at from close up in front.
 */
export function boxClearance(size: StudioSubjectSize) {
  const margin = subjectRadius(size) * clearance
  return ({x, y, z}: Vector3) => (Math.abs(x) * size.width + Math.abs(y) * size.height + Math.abs(z) * size.depth) / 2 + margin
}
