import type {RootState} from '@react-three/fiber'

import {Matrix4, PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu'

import {galleryEvents, useGallery} from '#src/lib/gallery.ts'
import world from '#src/worlds/current.ts'

const up = new Vector3(0, 1, 0)

/** Moves the player right in front of a hung portrait, facing it, unless it hangs in a room out of the world’s reach, where there is nothing to stand on. */
export default function teleportToPortrait(camera: RootState['camera'], id: string) {
  const portrait = useGallery.getState().portraits.find(candidate => candidate.id === id)
  if (!portrait?.hung || !world.portraitInReach(portrait)) {
    return
  }
  const normal = new Vector3(Math.sin(portrait.rotation), 0, Math.cos(portrait.rotation))
  galleryEvents.dispatchEvent(new Event('release-zoom'))
  const distance = camera instanceof PerspectiveCamera ? Math.max(portrait.height + 0.65, portrait.width / camera.aspect) / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.14 : 3
  const position = new Vector3(...portrait.position)
  position.addScaledVector(normal, distance)
  const lookAtPortrait = new Matrix4
  lookAtPortrait.lookAt(position, new Vector3(...portrait.position), up)
  const rotation = new Quaternion
  rotation.setFromRotationMatrix(lookAtPortrait)
  galleryEvents.dispatchEvent(new CustomEvent('teleport', {
    detail: {
      position: position.toArray(),
      rotation: rotation.toArray(),
    },
  }))
}
