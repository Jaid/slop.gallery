import type {FloorSize, RoomSpawn} from '../base/Room.ts'
import type {StudioLook} from './look.ts'
import type {StudioSkylight} from './skylights.ts'
import type {Vec3} from 'math'

import {Geofence} from 'geofency'

import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import {chandelierLamp, sandboxBaseboardHeight} from '../lib/sandboxFinish.ts'
import {planWall} from '../lib/walls.ts'
import {defaultStudioLook, moonDirectionOf} from './look.ts'
import map from './map.svg?raw'
import slots from './slots.ts'

/** the clear floor between the walls’ faces, wider than deep */
const clear = [12, 8] as const
/** the floor plan between the walls’ center lines, which the room’s size measures, round the clear floor */
const size: FloorSize = [clear[0] + wallFace * 2, clear[1] + wallFace * 2]
/** how high the walls rise, and the ceiling over them hangs */
const height = 10
const [width, depth] = size
/** where the floor and the faces of the north and east walls meet, relative to the room’s origin, the middle of its floor */
const corner: Vec3 = [width / 2 - wallFace, 0, -depth / 2 + wallFace]
/** the round skylights along the middle of the ceiling, either side of the lamp, relative to the room’s origin, which let the moon in wherever it stands */
const skylights: ReadonlyArray<StudioSkylight> = [-3, 3].map(x => ({
  center: [x, 0],
  radius: 1.3,
}))
/** from the spawn, in the Cell’s */
const spawnPoint: Vec3 = [0, 0.04, 2.5]

/** The Sandbox’s room for snapping and filming things, which loads in a moment: a floor 12 × 8 m between four walls 10 m high in finishes of the game’s rooms under a plaster ceiling, nothing else, lit by the Cell’s chandelier lamp without the chandelier and the moon falling in through two round skylights, each glazed in nine panes, all as the seed rolls them, every work framed alike in one of ten frames, the Cell’s by default. */
export default class Studio extends Room {
  override readonly air = floorBox(size, 0, height)
  /** where the floor and the faces of the north and east walls meet, relative to the room’s origin, which the Sandbox puts at the world’s origin */
  readonly corner = corner
  override readonly description = 'Four bare walls to snap and film things in.'
  override readonly fence = new Geofence([footprint([this.air])])
  override readonly height = height
  override readonly id = 'studio'
  override readonly size = size
  /** the round skylights in the ceiling the moon falls through */
  readonly skylights = skylights
  // Where the Cell’s is, looking into the corner.
  override readonly spawn: RoomSpawn = {
    position: spawnPoint,
    yaw: Math.atan2(spawnPoint[0] - corner[0], spawnPoint[2] - corner[2]),
    pitch: 0,
  }
  /** the direction toward the moon */
  readonly toMoon: Vec3

  /** @param look how the room is lit and its works are framed, the default environment’s by default */
  constructor(readonly look: StudioLook = defaultStudioLook) {
    const toMoon = moonDirectionOf(look)
    // The Cell’s walls, but for their cornice, which the plain ceiling does without.
    const wall = {
      baseboardHeight: sandboxBaseboardHeight,
      cornice: false,
    }
    super({
      title: 'Studio',
      // One for all works, as the seed rolls it.
      frame: look.frame,
      map,
      slots,
      lamps: {
        // Over the middle of the floor, as in the Cell.
        chandelier: {
          ...chandelierLamp([0, 0]),
          position: [0, look.lamp.height, 0],
          strength: look.lamp.strength,
          decay: look.lamp.decay,
          tint: look.lamp.tint,
        },
      },
      walls: {
        north: planWall(size, 'north', height, wall),
        east: planWall(size, 'east', height, wall),
        south: planWall(size, 'south', height, wall),
        west: planWall(size, 'west', height, wall),
      },
      // Nothing but the renderer’s clear black through the skylights.
      skybox: null,
      // Shafts of moonlight as faint as the Cell’s.
      volumetricSun: 0.07,
    })
    this.toMoon = toMoon
  }

  /** how high the air reaches, up to the ceiling */
  get clearHeight() {
    return height
  }

  /** How high the air reaches over any point of the floor: up to the level ceiling. */
  ceilingAt(_x: number, _z: number) {
    return height
  }

  /** Whether the position, relative to the room’s origin, lies on the floor, at least `margin` meters from the walls’ center lines. */
  floorContains([x, , z]: Vec3, margin = 0) {
    return Math.abs(x) <= width / 2 - margin && Math.abs(z) <= depth / 2 - margin
  }
}
