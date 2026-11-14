import type {Object3D} from 'three/webgpu'

import {Box3, Vector3} from 'three/webgpu'

/** A sphere around the actual model, including ornaments extending beyond a frame’s nominal dimensions, so rotating never crops a corner at the initial zoom. */
export function portraitStudioBounds(model: Object3D) {
  const box = new Box3
  box.setFromObject(model, true)
  return {
    center: box.getCenter(new Vector3),
    radius: box.getSize(new Vector3).length() / 2,
  }
}

/** Distance that fits the bounding sphere with a little breathing room, using the tighter of the horizontal and vertical fields of view. */
export function portraitStudioDistance(radius: number, aspect: number, fov: number) {
  const halfFov = Math.atan(Math.tan(fov * Math.PI / 360) * Math.min(1, aspect))
  return radius / Math.sin(halfFov) * 1.08
}
