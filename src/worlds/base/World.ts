import type IntroOrbit from '#src/lib/camera/IntroOrbit.ts'
import type {Artwork, PlayerPose, Portrait, Vec3} from '#src/lib/gallery/types.ts'
import type {PlacementSpace} from '#src/lib/placement/base/PlacementSpace.ts'
import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {WorldRoom} from '#src/lib/webmcp/analyzeWorld.ts'
import type {KnotDump} from '#src/lib/webmcp/tools.ts'
import type {GroundSurface, Room, SkyboxId} from '#src/rooms/index.ts'
import type {WorldId, WorldInfo} from '../index.ts'
import type {PlacedLamp} from './PlacedRoom.ts'
import type {Geofence} from 'geofency'
import type {ComponentType} from 'react'
import type {Node} from 'three/webgpu'

import Geofences from 'geofency'

import miterCorners from '#src/lib/gallery/cornerMiters.ts'
import {defaultPortraitArea} from '#src/lib/placement/portraitSlots.ts'

import PlacedRoom from './PlacedRoom.ts'

/** a room and the world position of its origin */
export type RoomPlacement<Kind extends Room = Room> = readonly [room: Kind, origin: Vec3]

const round = (value: number) => Math.round(value * 1e4) / 1e4 + 0

/**
 * A world the player can visit: the rooms it glues together, each at a placement of its own, and everything that spans them, like the walls artworks hang on, the floors and the scene that renders it all.
 *
 * Rooms come in the order their fences are checked, so where two fences overlap, the earlier room wins.
 * Components that render the world load lazily: they import the current world themselves, which only exists once its module has finished loading.
 */
export default abstract class World<Kind extends Room = Room> {
  /** how far ambient occlusion reaches around contacts, relative to the default */
  readonly ambientOcclusionThickness: number = 1
  /** the default works of the world before they hang in its portrait slots */
  abstract readonly artworks: ReadonlyArray<Artwork>
  /** the id of the room visitors start in, at its default spawn */
  abstract readonly defaultRoom: Kind['id']
  readonly enterLabel: string
  /** the rooms’ fences in world meters by room id, in the order of {@link rooms} */
  readonly geofences: Geofences<Kind['id'], Geofence>
  abstract readonly id: WorldId
  /** where the camera circles behind the first menu until the player first enters, there and then taking over the camera’s pose, or undefined for none, the default */
  readonly introOrbit: IntroOrbit | undefined = undefined
  /** the map of one floor of the world, its lower floors or its upper ones, of which the pause menu shows the one the player is on, see {@link isLowerFloor} */
  abstract readonly Minimap: ComponentType<{lower: boolean}>
  /** whether the welcome narration may play once the player first looks around */
  readonly narratesIntroduction: boolean = false
  /** where artworks hang and land */
  abstract readonly placement: PlacementSpace
  /** every room of the world, placed, in the order their fences are checked */
  readonly rooms: ReadonlyArray<PlacedRoom<Kind>>
  /** everything the world renders: its rooms, its lighting and its props */
  abstract readonly Scene: ComponentType
  readonly tagline: string
  readonly title: string
  /** the URL of the image behind the loading screen’s title */
  readonly wallpaper: string
  /** every wall of every room in world meters, room by room, their trim mitered where two walls meet in an inside corner */
  readonly walls: ReadonlyArray<Wall>
  private readonly byId: ReadonlyMap<Kind['id'], PlacedRoom<Kind>>

  constructor({enterLabel, tagline, title, wallpaper}: WorldInfo, placements: ReadonlyArray<RoomPlacement<Kind>>) {
    this.enterLabel = enterLabel
    this.tagline = tagline
    this.title = title
    this.wallpaper = wallpaper
    this.rooms = placements.map(([room, origin]) => new PlacedRoom(room, origin))
    this.byId = new Map(this.rooms.map(room => [room.id, room]))
    if (this.byId.size !== this.rooms.length) {
      throw new Error('Every room of a world needs an id of its own.')
    }
    this.geofences = new Geofences(this.rooms.map(room => [room.id, room.fence]))
    this.walls = miterCorners(this.rooms.flatMap(room => room.walls()))
  }

  /** the player’s pose on arrival: the default spawn of the {@link defaultRoom} */
  get spawn(): PlayerPose {
    return this.room(this.defaultRoom).spawn
  }

  /** The ambient sound with the id `ambience` within the room `room`, as an ambience emitter of its kind takes it: under its global id, from its point in world meters, in the rooms it is heard in. */
  ambience(room: Kind['id'], ambience: string) {
    const id = this.room(room).room.globalId(ambience)
    const placed = this.room(room).ambiences().find(candidate => candidate.id === id)
    if (!placed) {
      throw new Error(`${this.title} has no ambient sound “${id}”.`)
    }
    return {
      emitter: placed.emitter,
      id,
      position: placed.position,
      rooms: this.ambienceRooms(room, id),
    }
  }

  /** The rooms the player must be in to hear the room’s ambient sound with the global id: only its own room by default. */
  ambienceRooms(room: string, _ambience: string): ReadonlyArray<string> {
    return [room]
  }

  /** Every ambient sound of the world with its global id, from its point in world meters, room by room. */
  ambiences() {
    return this.rooms.flatMap(room => room.ambiences())
  }

  /** Every camera bookmark of the world in world meters, room by room. */
  cameraBookmarks() {
    return this.rooms.flatMap(room => room.cameras())
  }

  /** Whether the position lies anywhere a player or an artwork may be. */
  abstract contains(position: Vec3): boolean

  /** Every Knot in the world with its current session rarity, for the `dump_knots` WebMCP tool; none by default. */
  dumpKnots(): ReadonlyArray<KnotDump> {
    return []
  }

  /** The height of the walkable floor under the position. */
  abstract floorHeight(position: Vec3): number

  /** The frame the work with the id `work` wears arriving at the position in the game of `seed`: its roll of the frames of the room whose fence holds it, or undefined for the default frame, also outside of every fence. */
  frameAt(position: Vec3, seed: number, work: string) {
    return this.roomAt(position)?.frame(seed, work)
  }

  /** What the ground under the position sounds like in the room the player is in. */
  groundSurface(room: string, position: Vec3): GroundSurface {
    return this.roomById(room)?.groundSurface(position) ?? 'generic'
  }

  /**
   * Whether a position in the room shows on the lower floor of the map: by the room’s floor, unless the floor under it lies in the part of the room that climbs to the floor above; a position outside of every room counts by its own height.
   * A world whose rooms all lie on the ground has no lower floor.
   */
  isLowerFloor(room: PlacedRoom<Kind> | undefined, position: Vec3) {
    if (!room) {
      return position[1] < 0
    }
    const {floorY, upperMap} = room
    return floorY < 0 && !(upperMap && this.floorHeight(position) >= floorY + upperMap.from)
  }

  /** The rooms the player must be in for the lamp to shine, or undefined for everywhere, the default. */
  lampRooms(_lamp: PlacedLamp): ReadonlyArray<string> | undefined {
    return undefined
  }

  /** Every lamp of the world with its global id in world meters, room by room. */
  lamps() {
    return this.rooms.flatMap(room => room.lamps())
  }

  /** How opaque the drawing of a room is on the map while the player is in the room with the id `current`: faint for every room and a little stronger for the player’s own. */
  mapOpacity(room: PlacedRoom<Kind>, current: string) {
    return room.id === current ? 0.25 : 0.1
  }

  /** The frame area in cm² of a work imported onto the wall with the id `wallId`, that of the room owning the wall, or, dropped instead, that of the player’s room `room`; {@link defaultPortraitArea} for a room the world doesn’t know. */
  portraitArea(wallId: string | undefined, room: string) {
    const owner = wallId === undefined ? room : this.placement.wall(wallId)?.room ?? room
    return this.roomById(owner)?.portraitArea ?? defaultPortraitArea
  }

  /** The room a work is in while it is at the position: the one owning the wall it hangs on, or else the first whose fence holds the position; undefined for a loose work outside of every fence, like in a passage. */
  portraitRoom({hung, wallId}: Pick<Portrait, 'hung' | 'wallId'>, position: Vec3) {
    const wall = hung && wallId !== undefined ? this.placement.wall(wallId) : undefined
    return (wall && this.roomById(wall.room)) ?? this.roomAt(position)
  }

  /** Every portrait slot of the world in world meters, room by room. */
  portraitSlots() {
    return this.rooms.flatMap(room => room.slots())
  }

  /** The placed room with the id. */
  room<Id extends Kind['id']>(id: Id): PlacedRoom<Extract<Kind, {id: Id}>> {
    const room = this.byId.get(id)
    if (!room) {
      throw new Error(`${this.title} has no room “${id}”.`)
    }
    return room as PlacedRoom<Extract<Kind, {id: Id}>>
  }

  /** The first room whose fence holds the position, or undefined outside of every fence. */
  roomAt(position: Vec3) {
    const id = this.geofences.getMatch(position)
    return id === null ? undefined : this.byId.get(id)
  }

  /** The placed room with the id, or undefined for an id the world doesn’t know, like one from a URL. */
  roomById(id: string) {
    return this.byId.get(id)
  }

  /** What the pause menu shows below the title of the room the player is in. */
  roomTagline(room: PlacedRoom<Kind>) {
    return room.description
  }

  /** What the scene’s background shows for a skybox id its rooms name, which the world may pick by its own state, like its weather, or null for nothing but the renderer’s clear color: none for every id by default. */
  skybox(_id: SkyboxId): Node | null {
    return null
  }

  /** Every spawn bookmark of the world in world meters, room by room. */
  spawnBookmarks() {
    return this.rooms.flatMap(room => room.spawns())
  }

  /** How far a ray from the origin travels until it meets a wall, which interaction never reaches through. */
  abstract wallDistance(origin: Vec3, direction: Vec3): number

  /** Every room as the union of its air’s boxes in world meters, for the `analyze_world` WebMCP tool. */
  worldRooms(): ReadonlyArray<WorldRoom> {
    return this.rooms.map(room => {
      const boxes = room.air.map(({min, max}) => ({
        min: [round(min.x), round(min.y), round(min.z)] as [number, number, number],
        max: [round(max.x), round(max.y), round(max.z)] as [number, number, number],
      }))
      return {
        id: room.id,
        title: room.title,
        fence: boxes.length === 1 ? boxes[0] : boxes,
      }
    })
  }
}
