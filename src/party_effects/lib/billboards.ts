import type {Node} from 'three/webgpu'

import {cameraWorldMatrix, float, vec3, vec4} from 'three/tsl'

/** where the camera’s right points in the world */
export const cameraRight = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz
/** where the camera’s up points in the world */
export const cameraUp = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz

/** Where the offset from a site’s center lies, from the mesh standing there: `along` to the right of someone facing it, `up` and `out` the way it faces, in meters. */
export function partyPoint(tangent: Node<'vec3'>, normal: Node<'vec3'>, along: Node<'float'> | number, up: Node<'float'> | number, out: Node<'float'> | number) {
  return tangent.mul(along).add(vec3(0, 1, 0).mul(up)).add(normal.mul(out))
}

/** The axes of a quad that lies flat in the camera’s view, its right and up turned by `roll` radians counterclockwise. */
export function screenAxes(roll: Node<'float'> | number = 0) {
  const angle = typeof roll === 'number' ? float(roll) : roll
  return {
    right: cameraRight.mul(angle.cos()).add(cameraUp.mul(angle.sin())),
    up: cameraUp.mul(angle.cos()).sub(cameraRight.mul(angle.sin())),
  }
}
