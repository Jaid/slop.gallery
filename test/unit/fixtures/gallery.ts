import type {Vec3} from '../../../src/lib/gallery/types.ts'
import type {FloorSize} from '../../../src/rooms/index.ts'
import type PlacedRoom from '../../../src/worlds/base/PlacedRoom.ts'
import type {GalleryRoom} from '../../../src/worlds/gallery/index.ts'

import slopGallery from '../../../src/worlds/gallery/index.ts'

/** a room of the gallery around a rectangular floor plan */
export type Hall = PlacedRoom<GalleryRoom> & {
  height: number
  size: FloorSize
}

/** the gallery’s rooms around a rectangular floor plan, every room but the Exhibition and the Bastion */
export const rooms = slopGallery.rooms.filter((room): room is Hall => room.size !== undefined)
const {walls} = slopGallery
export const galleryPlacement = slopGallery.placement
export const insideGallery = (position: Vec3) => slopGallery.contains(position)
export const floorHeight = (position: Vec3) => slopGallery.floorHeight(position)
/** the id of the room whose fence holds the position first */
export const roomAt = (position: Vec3) => slopGallery.roomAt(position)?.id
/** Height from a room’s floor to the highest point of its ceiling: the crown of the Lobby’s vault or the Antechamber’s dome, the Vesper’s lantern, the Salon’s laylight or the room’s flat ceiling. */
export const roomClearHeight = (room: PlacedRoom) => room.air[0].max.y - room.floorY

/** Where a visitor stands to look around a room: 1.7 m over its floor, 2.4 m in front of its south wall facing north, in the middle of the Corridor and just north of the Antechamber’s middle, facing south. */
export function roomVisit(room: Hall): {
  position: Vec3
  rotation: [number, number, number, number]
} {
  if (room.id === 'corridor') {
    return {
      position: [room.center[0], room.floorY + 1.7, room.center[1]],
      rotation: [0, 0, 0, 1],
    }
  }
  return {
    position: [room.center[0], room.floorY + 1.7, room.center[1] + (room.id === 'antechamber' ? -1.1 : room.size[1] / 2 - 2.4)],
    rotation: room.id === 'antechamber' ? [0, 1, 0, 0] : [0, 0, 0, 1],
  }
}

export default walls
