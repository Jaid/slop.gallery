import type IntroOrbit from '#src/lib/camera/IntroOrbit.ts'
import type {Artwork, CameraBookmark, PlayerPose, Portrait, Vec3} from '#src/lib/gallery/types.ts'
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

import {readDevelopmentMode} from '#src/lib/developmentMode.ts'
import miterCorners from '#src/lib/gallery/cornerMiters.ts'
import {findNamedBookmark, readRoom, readSpawn} from '#src/lib/gallery/spawn.ts'
import {defaultPortraitArea} from '#src/lib/placement/portraitSlots.ts'

import PlacedRoom from './PlacedRoom.ts'
import WorldReach, {readWorldReach} from './WorldReach.ts'

/** a room and the world position of its origin */
export type RoomPlacement<Kind extends Room = Room> = readonly [room: Kind, origin: Vec3]

/** where a page starts in a world, as its URL says */
export type WorldStart = {
  /** whether `?spawn` makes the player start flying: a camera bookmark with `?development`, to fly on from there */
  flying: boolean
  /** where the player starts: on the spawn bookmark `?spawn` names, below the camera bookmark it names, at the default spawn of the room `?room` names, or else at the world’s spawn, which also stands in for a place outside of the world */
  pose: PlayerPose
  /** what `?spawn` or `?room` names that the world doesn’t have, which leaves the player at the world’s spawn */
  unknown?: {
    id: string
    parameter: 'room' | 'spawn'
  }
}

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
  private pageReach: WorldReach | undefined = undefined
  private wallIndex: ReadonlyMap<string, Wall> | undefined = undefined

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

  /**
   * How much of the world this page mounts, by its `?world_reach`, around the room the player starts in; read once.
   * Everything that builds a part of the world asks it before building that part, which no other part builds as a side effect: a room’s geometry, walls, lamps, works and props.
   */
  get reach(): WorldReach {
    this.pageReach ??= this.reachOf()
    return this.pageReach
  }

  /** the player’s pose on arrival: the default spawn of the {@link defaultRoom} */
  get spawn(): PlayerPose {
    return this.room(this.defaultRoom).spawn
  }

  /** the spawn of a room that is there: the {@link spawn}, unless the {@link defaultRoom} is out of {@link reach}, and then the default spawn of the room it reaches out from */
  get spawnInReach(): PlayerPose {
    const {covers, origin} = this.reach
    return covers(this.defaultRoom) ? this.spawn : this.room(origin).spawn
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

  /** Where the player stands below a camera bookmark: a standing eye height under the camera, but never below the floor unless `flying`. */
  cameraBookmarkFeet({position}: Pick<CameraBookmark, 'position'>, flying = false): Vec3 {
    const feet = position[1] - 1.6
    return [position[0], flying ? feet : Math.max(this.floorHeight(position) + 0.04, feet), position[2]]
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

  /** Every lamp of the world with its global id in world meters, room by room, those of rooms out of {@link reach} too. */
  lamps() {
    return this.rooms.flatMap(room => room.lamps())
  }

  /** How opaque the drawing of a room is on the map while the player is in the room with the id `current`: faint for every room and a little stronger for the player’s own. */
  mapOpacity(room: PlacedRoom<Kind>, current: string) {
    return room.id === current ? 0.25 : 0.1
  }

  /** The rooms next to the room, which `?world_reach=neighbors` mounts along with it: none by default. */
  neighbors(_room: string): ReadonlyArray<string> {
    return []
  }

  /** The frame area in cm² of a work imported onto the wall with the id `wallId`, that of the room owning the wall, or, dropped instead, that of the player’s room `room`; {@link defaultPortraitArea} for a room the world doesn’t know. */
  portraitArea(wallId: string | undefined, room: string) {
    const owner = wallId === undefined ? room : this.wall(wallId)?.room ?? room
    return this.roomById(owner)?.portraitArea ?? defaultPortraitArea
  }

  /** Whether the work belongs to the part of the world this page mounts, see {@link reach}: any work but one hanging on a wall of a room out of reach. A loose work always does, as it can only have got loose in reach. */
  portraitInReach({hung, wallId}: Pick<Portrait, 'hung' | 'wallId'>, reach: Pick<WorldReach, 'covers'> = this.reach) {
    const wall = hung && wallId !== undefined ? this.wall(wallId) : undefined
    return !wall || reach.covers(wall.room)
  }

  /** The room a work is in while it is at the position: the one owning the wall it hangs on, or else the first whose fence holds the position; undefined for a loose work outside of every fence, like in a passage. */
  portraitRoom({hung, wallId}: Pick<Portrait, 'hung' | 'wallId'>, position: Vec3) {
    const wall = hung && wallId !== undefined ? this.wall(wallId) : undefined
    return (wall && this.roomById(wall.room)) ?? this.roomAt(position)
  }

  /** Every portrait slot of the world in world meters, room by room. */
  portraitSlots() {
    return this.rooms.flatMap(room => room.slots())
  }

  /** How much of the world a page with the URL mounts, by its `?world_reach`, around the room the player {@link start}s in, the world’s default room outside of every fence. */
  reachOf(input?: URL | string) {
    const {position} = this.start(input).pose
    return new WorldReach(readWorldReach(input), this.roomAt(position)?.id ?? this.defaultRoom, this)
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

  /**
   * Where a page with the URL starts: with `?spawn`, on that spawn bookmark or below that camera bookmark, which wins over a spawn bookmark of the same ID, with `?development` flying with its eyes at the bookmark; without `?spawn`, at the default spawn of the room `?room` names; otherwise at the world’s spawn.
   * Pure, so the {@link reach} that depends on it is known before anything places the player.
   */
  start(input?: URL | string): WorldStart {
    const camera = findNamedBookmark(this.cameraBookmarks(), input)
    const bookmark = camera ? null : findNamedBookmark(this.spawnBookmarks(), input)
    const at = (pose: PlayerPose, flying = false): WorldStart => ({
      pose: this.contains(pose.position) ? pose : this.spawn,
      flying,
    })
    if (bookmark) {
      const {position, yaw, pitch} = bookmark
      return at({
        position,
        yaw,
        pitch,
      })
    }
    if (camera) {
      const flying = readDevelopmentMode(input)
      return at({
        position: this.cameraBookmarkFeet(camera, flying),
        ...camera.aim,
      }, flying)
    }
    if (bookmark === undefined) {
      return {
        pose: this.spawn,
        flying: false,
        unknown: {
          parameter: 'spawn',
          id: readSpawn(input),
        },
      }
    }
    const roomId = readRoom(input)
    const room = roomId ? this.roomById(roomId) : undefined
    if (room) {
      const {position, yaw, pitch} = room.spawn
      return at({
        position,
        yaw,
        pitch,
      })
    }
    return {
      pose: this.spawn,
      flying: false,
      ...roomId ? {
        unknown: {
          parameter: 'room',
          id: roomId,
        },
      } : {},
    }
  }

  /** The wall with the global id, of any room, also one out of {@link reach} that isn’t there to hang anything on; undefined for an id the world doesn’t know. */
  wall(id: string) {
    this.wallIndex ??= new Map(this.walls.map(wall => [wall.id, wall]))
    return this.wallIndex.get(id)
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
