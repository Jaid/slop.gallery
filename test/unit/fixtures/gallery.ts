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
/** Height from a room’s floor to the highest point of its ceiling: the crown of the Lobby’s vault or the Antechamber’s dome, the ridge of the Vesper’s lantern, the flat ceiling everywhere else. */
export const roomClearHeight = (room: PlacedRoom) => room.air[0].max.y - room.floorY

export default walls
