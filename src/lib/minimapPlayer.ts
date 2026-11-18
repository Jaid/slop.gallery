import type {Vec3} from './gallery/types.ts'

/** The live camera values projected onto the map’s world x/z plane. */
export type MinimapPose = {
  direction: Vec3
  position: Vec3
}

export const minimapHeading = ([x, , z]: Vec3) => Math.atan2(x, -z) * 180 / Math.PI
export const playerTransform = ({position: [x, , z], direction}: MinimapPose) => `translate(${x} ${z}) rotate(${minimapHeading(direction)})`
