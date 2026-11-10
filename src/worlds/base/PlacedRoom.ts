import type {CameraBookmark, PortraitSlot, SpawnBookmark} from '#src/lib/gallery/types.ts'
import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {Lamp, Room, RoomSpawn} from '#src/rooms/index.ts'
import type {Vec3} from 'math'

import {Vector3} from 'three/webgpu'

import {pickFrame} from '#src/lib/frames/frameChoice.ts'
import {slotFrame} from '#src/lib/placement/portraitSlots.ts'
import {placeWalls} from '#src/rooms/lib/walls.ts'

/** a lamp with its global id, positioned in world meters */
export type PlacedLamp = Lamp & {
  id: string
  /** the id of the room it belongs to */
  room: string
}

/**
 * A room as a world placed it: the same building block with its origin at a world position, handing out everything about the room in world meters and under global ids.
 */
export default class PlacedRoom<Kind extends Room = Room> {
  /** the room’s fence in world meters */
  readonly fence: Kind['fence']

  constructor(readonly room: Kind, readonly origin: Vec3) {
    this.fence = room.fence.translate(origin)
  }

  /** the room’s air in world meters */
  get air() {
    const offset = new Vector3(...this.origin)
    return this.room.airBoxes.map(box => box.clone().translate(offset))
  }

  /** the world x and z of the room’s origin, the middle of its floor plan */
  get center(): readonly [x: number, z: number] {
    return [this.origin[0], this.origin[2]]
  }

  get description() {
    return this.room.description
  }

  /** the world height of the room’s main floor in meters, which its floor reflection mirrors at: the height of its origin */
  get floorY() {
    return this.origin[1]
  }

  /** the height of the ceiling over the floor of a room around a rectangular floor plan */
  get height(): Kind['height'] {
    return this.room.height
  }

  get id(): Kind['id'] {
    return this.room.id
  }

  /** the room’s floor plan on the map, relative to its origin; place it at {@link center} */
  get map() {
    return this.room.map
  }

  /** the id of the mood that holds while the listener is in the room, or undefined for none */
  get mood() {
    return this.room.mood
  }

  /** the frame area in cm² of works imported onto the room’s walls or dropped into it by a player inside */
  get portraitArea() {
    return this.room.portraitArea
  }

  /** the extent of the floor plan of a room around a rectangular one, centered on {@link center} */
  get size(): Kind['size'] {
    return this.room.size
  }

  get skybox() {
    return this.room.skybox
  }

  /** the room’s default spawn in world meters */
  get spawn(): RoomSpawn {
    return {
      ...this.room.spawn,
      position: this.toWorld(this.room.spawn.position),
    }
  }

  get sunlit() {
    return this.room.sunlit
  }

  get title() {
    return this.room.title
  }

  /** the part of the room’s floor plan on the floor above, relative to its origin, if the room climbs there; place it at {@link center} */
  get upperMap() {
    return this.room.upperMap
  }

  get volumetricSun() {
    return this.room.volumetricSun
  }

  /** The camera bookmarks with global ids in world meters. */
  cameras(): Array<CameraBookmark> {
    return this.room.cameras.entries().map(([id, camera]) => ({
      ...camera,
      id: this.room.globalId(id),
      position: this.toWorld(camera.position),
    })).toArray()
  }

  /** The frame the work with the id `work` wears hanging in one of the room’s slots or arriving in the room in the game of `seed`, its own roll where the room has several, or undefined for the default frame. */
  frame(seed: number, work: string) {
    return this.room.frame && pickFrame(seed, this.room.frame, work)
  }

  /** What the ground under the world position sounds like. */
  groundSurface(position: Vec3) {
    return this.room.groundSurface(this.toLocal(position))
  }

  /** Every lamp with its global id and its position, and a spot’s target, in world meters. */
  lamps(): Array<PlacedLamp> {
    return this.room.lamps.entries().map(([id, lamp]) => ({
      ...lamp,
      id: this.room.globalId(id),
      room: this.room.id,
      position: this.toWorld(lamp.position),
      ...lamp.kind === 'spot' ? {target: this.toWorld(lamp.target)} : {},
    })).toArray()
  }

  /** The portrait slots with global ids in world meters, as the placement code takes them, each with the room’s frames. */
  slots(): Array<PortraitSlot> {
    const {frame} = this.room
    return this.room.slots.entries().map(([id, {area, position, priority = 0, labelAbove, wallId, ...slot}]) => ({
      id: this.room.globalId(id),
      ...slot,
      wallId: this.room.globalId(wallId),
      priority,
      ...slotFrame(slot.ratio, area),
      position: this.toWorld(position),
      ...labelAbove ? {labelAbove} : {},
      ...frame ? {frame} : {},
    })).toArray()
  }

  /** The spawn bookmarks with global ids in world meters. */
  spawns(): Array<SpawnBookmark> {
    return this.room.spawns.entries().map(([id, spawn]) => ({
      ...spawn,
      id: this.room.globalId(id),
      position: this.toWorld(spawn.position),
    })).toArray()
  }

  /** The position relative to the room’s origin of a point given in world meters. */
  toLocal([x, y, z]: Vec3): Vec3 {
    return [x - this.origin[0], y - this.origin[1], z - this.origin[2]]
  }

  /** The world position of a point given relative to the room’s origin. */
  toWorld([x, y, z]: Vec3): Vec3 {
    return [this.origin[0] + x, this.origin[1] + y, this.origin[2] + z]
  }

  /** The walls with global ids in world meters, their holes in a list that keeps their names, as the placement code and the architecture take them. */
  walls(): Array<Wall> {
    return placeWalls(this.room.id, this.origin, this.room.walls)
  }
}
