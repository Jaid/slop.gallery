import type {Vec3} from './types.ts'

import {GeofenceSession} from 'geofency'

import world from '#src/worlds/current.ts'

import {useGallery} from './store.ts'

/**
 * Follows a position, the player’s place (`bodyPose.place`), through the fences of the current world’s rooms and keeps the store’s `room` on the room it entered last; passages between fences keep the room the player came from.
 * It starts silently in the room the position lies in, the room of a restored game or a bookmark, so that only actually walking into another room counts as a change.
 */
export default function followRooms(position: Vec3) {
  const initialValue: string = world.roomAt(position)?.id ?? world.defaultRoom
  const session = new GeofenceSession(world.geofences, {initialValue})
  useGallery.setState({room: initialValue})
  session.on('change', room => {
    if (room !== null) {
      useGallery.setState({room})
    }
  })
  return session
}
