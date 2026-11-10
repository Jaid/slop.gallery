import type {FrameChoice} from '#src/lib/frames/frameChoice.ts'
import type {CameraBookmark, PortraitRatio, SpawnBookmark} from '#src/lib/gallery/types.ts'
import type Mood from '#src/lib/moods/base/Mood.ts'
import type {Wall, WallOpening} from '#src/lib/placement/wallGeometry.ts'
import type AmbienceEmitter from 'ambience-emitter'
import type {Geofence} from 'geofency'
import type {Vec3} from 'math'

import {Box3} from 'three/webgpu'

import {defaultPortraitArea} from '#src/lib/placement/portraitSlots.ts'

import RoomMap from '../lib/RoomMap.ts'

/** what the ground under the player’s feet is made of, which their footsteps sound like */
export type GroundSurface = 'fabric' | 'generic' | 'glass' | 'hollow' | 'stone'
/** an ambience emitter class whose instances can sound from any world position and in any rooms */
export type AmbienceEmitterClass = new (position?: Vec3, rooms?: ReadonlyArray<string>) => AmbienceEmitter
/** a looping ambient sound of a room */
export type RoomAmbience = {
  emitter: AmbienceEmitterClass
  /** where the sound comes from, relative to the room’s origin */
  position: Vec3
}
/** a named camera view in the room, positioned relative to the room’s origin */
export type RoomCamera = Omit<CameraBookmark, 'id'>
/** a player pose in the room to arrive or teleport at, its feet positioned relative to the room’s origin */
export type RoomSpawn = Omit<SpawnBookmark, 'id'>
/** a wall of the room, the middle of its foot positioned relative to the room’s origin; it faces +z into the room before turning by its rotation around y */
export type RoomWall = Omit<Wall, 'baseboardMiters' | 'holes' | 'id' | 'miters' | 'room'> & {
  /** the openings through the wall by their names within it, in snake_case, along the wall from its center */
  holes?: Record<string, Omit<WallOpening, 'name'>>
}
/** the extent of a rectangle on the floor plan along x and z */
export type FloorSize = readonly [width: number, depth: number]
export type PointLamp = LampBase & {
  kind?: 'point'
}
export type SpotLamp = LampBase & {
  /** half the cone’s opening in radians */
  angle: number
  kind: 'spot'
  /** share of the cone’s edge that fades out, 0–1 */
  penumbra?: number
  /** the point the spot aims at, relative to the room’s origin */
  target: Vec3
}
/** a spot on a wall of the room reserved for one default work of matching ratio */
export type RoomPortraitSlot = {
  /** frame area in cm², which sets the frame’s size together with its ratio */
  area: number
  /** whether the slot hangs low and its work’s placard goes above the frame */
  labelAbove?: boolean
  /** center of the frame, hanging in front of its wall, relative to the room’s origin */
  position: Vec3
  /** Default works fill free slots of higher priority first, and slots of equal priority in random order; 0 by default. */
  priority?: number
  ratio: PortraitRatio
  /** turn around y in radians, the same as its wall’s */
  rotation: number
  /** the wall’s id within the room, in snake_case */
  wallId: string
}
/** a light fixed in a room */
export type Lamp = PointLamp | SpotLamp
export type RoomOptions = {
  /** the room’s ambient sounds by their id within the room, in snake_case */
  ambience?: Record<string, RoomAmbience>
  /** the camera bookmarks by their id within the room, in snake_case */
  cameras?: Record<string, RoomCamera>
  /** the frame the works wear that hang in the room’s slots or arrive in the room, or several, of which every work draws its own, the default frame if left out */
  frame?: FrameChoice
  /** the lamps by their id within the room, in snake_case, positioned relative to the room’s origin */
  lamps?: Record<string, Lamp>
  /** the room’s floor plan on the map as SVG markup, usually the room’s own map.svg: a drawing in meters relative to the room’s origin that its viewBox frames */
  map?: string
  /** the moods that hold while the listener is in the room, beneath any mood cast over the world, like a `RoomMood` of its acoustics, a `reverberation` of what it is built of; left out, the world sounds dry there */
  moods?: ReadonlyArray<Mood>
  /** the frame area in cm² of works imported onto the room’s walls or dropped into it by a player inside, at which they keep their own aspect; {@link defaultPortraitArea} if left out */
  portraitArea?: number
  /**
   * the id of the skybox behind the world while the player is in the room, like `sky`, which the world resolves to one of its own, maybe by its weather
   *
   * `null` shows none, only the renderer’s clear color, as for rooms without a view outside whose long, level views end in rooms culled behind them. Left out, entering the room keeps the skybox that showed before.
   */
  skybox?: SkyboxId | null
  /** the portrait slots by their id within the room, in snake_case, which stays stable so edited slots find their originals */
  slots?: Record<string, RoomPortraitSlot>
  /** the spawn bookmarks by their id within the room, in snake_case; the empty id is the room’s default spawn, which goes by the room’s own id */
  spawns?: Record<string, RoomSpawn>
  /** whether the sun may reach into the room anywhere, which keeps it in the sun’s shadow map; rooms deep underground, whose materials ignore the sun, leave it out; true by default */
  sunlit?: boolean
  title: string
  /** the part of the room’s floor plan that climbs to the floor above, which the map shows there instead of on the room’s own floor */
  upperMap?: UpperMapOptions
  /** how strongly the air holds sun shafts while the player is inside, 1 at full strength; 0 turns volumetric sunlight off */
  volumetricSun?: number
  /** the room’s walls by their id within the room, in snake_case */
  walls?: Record<string, RoomWall>
}
/** what a room calls the skybox it shows, which its world resolves */
export type SkyboxId = string
/** the part of a room’s floor plan on the floor above the room’s own */
export type UpperMap = {
  /** the floor height over the room’s origin from which on the room belongs to the floor above */
  from: number
  /** the part’s floor plan, drawn like the room’s own map */
  map: RoomMap
}
/** the part of a room’s floor plan on the floor above the room’s own, its drawing as SVG markup, usually the room’s own upperMap.svg */
export type UpperMapOptions = Omit<UpperMap, 'map'> & {map: string}
type LampBase = {
  /** how quickly the light fades with distance, 2 (physical) by default */
  decay?: number
  /** whether the lamp goes out when only the essential lamps are on */
  optional?: boolean
  /** relative to the room’s origin, in meters */
  position: Vec3
  /** meters after which the light is cut off; 0 or left out reaches forever */
  range?: number
  /** whether the lamp casts shadows, always or only in heavy graphics; point lights borrow a slot of the shadow pool for it */
  shadow?: 'heavy' | boolean
  /** luminous intensity in candela, 1 by default */
  strength?: number
  /** light color as #rrggbb, white by default */
  tint?: string
}
type Arrayable<T> = ReadonlyArray<T> | T

/**
 * A room as a building block of a world: what it is called, the air it fences off, where visitors arrive and how the sun behaves inside.
 * Rooms are position-free. Everything about them is relative to their origin, usually the middle of their main floor, and the world they are part of decides where that origin lies.
 * Subclasses declare their identity and geometry as class fields and pass the rest to the constructor.
 * Field initializers of subclasses run after this constructor, so everything derived from them is a getter.
 */
export default abstract class Room {
  /** the room’s air as one bounded box or several, from its floor (or the bottom of a sunken one) to its clear height; what culling and the analysis of a world count as inside the room */
  abstract readonly air: Arrayable<Box3>
  readonly ambience: ReadonlyMap<string, RoomAmbience>
  readonly cameras: ReadonlyMap<string, RoomCamera>
  /** a sentence shown below the title */
  abstract readonly description: string
  /**
   * where a visitor counts as inside the room, as a geofence whose boxes may reach endlessly up or down: a room only needs to own its own footprint at its own level
   *
   * Worlds check the fences of their rooms in order and take the first one that matches, so a fence may overlap those of the rooms checked before it.
   */
  abstract readonly fence: Geofence
  /** the frame the works wear that hang in the room’s slots or arrive in the room, or several, of which every work draws its own, or undefined for the default frame */
  readonly frame: FrameChoice | undefined
  /** how high the ceiling of a room around a rectangular floor plan hangs over its floor, the walls stopping 30 cm short of it */
  readonly height?: number
  /** in snake_case, also the prefix of the global ids of everything in the room */
  abstract readonly id: string
  readonly lamps: ReadonlyMap<string, Lamp>
  /** the room’s floor plan on the map, if it has one */
  readonly map: RoomMap | undefined
  /** the moods that hold while the listener is in the room */
  readonly moods: ReadonlyArray<Mood>
  /** the frame area in cm² of works imported onto the room’s walls or dropped into it by a player inside */
  readonly portraitArea: number
  /** the width along x and the depth along z of a room around a rectangular floor plan, centered on its origin */
  readonly size?: FloorSize
  /** the id of the skybox behind the world while the player is inside, `null` for none or undefined to keep the one that showed before */
  readonly skybox: SkyboxId | null | undefined
  readonly slots: ReadonlyMap<string, RoomPortraitSlot>
  /** where visitors arrive, usually the room’s default spawn, the empty id of {@link spawns} */
  abstract readonly spawn: RoomSpawn
  readonly spawns: ReadonlyMap<string, RoomSpawn>
  readonly sunlit: boolean
  readonly title: string
  /** the part of the room’s floor plan the map shows on the floor above, if the room climbs there */
  readonly upperMap: UpperMap | undefined
  readonly volumetricSun: number
  readonly walls: ReadonlyMap<string, RoomWall>

  constructor({title, moods = [], lamps = {}, ambience = {}, cameras = {}, frame, map, upperMap, portraitArea = defaultPortraitArea, slots = {}, spawns = {}, walls = {}, skybox, sunlit = true, volumetricSun = 1}: RoomOptions) {
    this.title = title
    this.moods = moods
    this.frame = frame
    this.portraitArea = portraitArea
    this.map = map === undefined ? undefined : new RoomMap(map)
    this.upperMap = upperMap && {
      ...upperMap,
      map: new RoomMap(upperMap.map),
    }
    this.lamps = new Map(Object.entries(lamps))
    this.ambience = new Map(Object.entries(ambience))
    this.slots = new Map(Object.entries(slots))
    this.cameras = new Map(Object.entries(cameras))
    this.spawns = new Map(Object.entries(spawns))
    this.walls = new Map(Object.entries(walls))
    this.skybox = skybox
    this.sunlit = sunlit
    this.volumetricSun = volumetricSun
  }

  /** the boxes of the {@link air}, always as a list */
  get airBoxes(): ReadonlyArray<Box3> {
    return this.air instanceof Box3 ? [this.air] : this.air
  }

  /** the box around all of the room’s {@link air} */
  get bounds() {
    return this.airBoxes.reduce((result, box) => result.union(box), new Box3)
  }

  /** whether sun shafts render while the player is inside */
  get hasVolumetricSun() {
    return this.volumetricSun > 0
  }

  /** The world-wide id of a lamp, ambient sound, wall, slot or bookmark of the room: the room’s id and the id within the room, joined by a hyphen, or just the room’s id for the empty id of its default. */
  globalId(id: string) {
    return id ? `${this.id}-${id}` : this.id
  }

  /** What the ground under the position, relative to the room’s origin, sounds like: plain hard ground unless the room says otherwise. */
  groundSurface(_position: Vec3): GroundSurface {
    return 'generic'
  }
}
