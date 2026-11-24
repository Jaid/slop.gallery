import type {FloorSize, PointLamp, RoomCamera, RoomSpawn} from '../base/Room.ts'
import type {StudioDesign} from './design.ts'
import type {StudioLamp, StudioLook} from './look.ts'
import type {StudioOpenings} from './openings/index.ts'
import type {StudioPlan} from './plan.ts'
import type {Vec3} from 'math'
import type {Box3} from 'three/webgpu'

import {Geofence} from 'geofency'

import {defaultSeed} from '#src/lib/environmentSeed.ts'
import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import {chandelierLamp, sandboxBaseboardHeight} from '../lib/sandboxFinish.ts'
import {planWall} from '../lib/walls.ts'
import {designLook, designPlan, studioDesign} from './design.ts'
import {moonDirectionOf} from './look.ts'
import studioMap from './map.ts'
import {studioOpenings} from './openings/index.ts'
import studioSlots from './slots.ts'

/** Where the player arrives, relative to the north-western corner of the floor: 3 m in from the west wall and 5 m from the north wall, looking north at the works and a little down, like the {@link overview} but 2 m nearer, 1 m farther west and standing. */
const arrival = {
  position: [3, 0.04, 5],
  yaw: 0,
  pitch: -8 * Math.PI / 180,
} as const satisfies RoomSpawn
/** The view the seeds of the Studio compare in, which every room size frames alike, as it only shows the north and west walls, their corner and the works between: its eyes 4 m in from the west wall, 7 m from the north wall and 2 m over the floor, relative to the north-western corner of the floor, looking north and a little down. */
const overview = {
  position: [4, 2, 7],
  aim: {
    yaw: 0,
    pitch: -8 * Math.PI / 180,
  },
  fov: 65,
  ratio: 16 / 9,
} as const satisfies RoomCamera
/** shadow map lookups per pixel of a lamp’s wide blur, as many as a fusion portal’s */
export const lampBlurSamples = 16
/** the ids of the Studio’s lamps within the room, by the lamp of its look */
export const studioLampIds = {
  primary: 'primary-lamp',
  secondary: 'secondary-lamp',
} as const satisfies Record<keyof StudioLook['lamps'], string>

/** The softened shadow of a lamp whose shadow blurs `blur` degrees wide, or nothing for one that blurs as every lamp’s do. */
export function lampSoftShadow(blur: number) {
  return blur > 0 ? {
    blurAngle: blur * Math.PI / 180,
    softSamples: lampBlurSamples,
  } : undefined
}
/** A lamp of the Studio as its look has it: the Cell’s chandelier’s, as bright, warm and far reaching as the look says, where it says. */
const studioLamp = ({blur, decay, position, range, strength, tint}: StudioLamp): PointLamp => {
  const softShadow = lampSoftShadow(blur)
  return {
    ...chandelierLamp([0, 0]),
    position,
    strength,
    decay,
    range,
    tint,
    ...softShadow ? {softShadow} : {},
  }
}

/** The Sandbox’s room for snapping and filming things, which loads in a moment: a floor between four walls in finishes of the game’s rooms under a thin plaster ceiling, nothing else, lit by the Cell’s chandelier lamp without the chandelier, a secondary lamp on some seeds and the moon, or a warm sun, falling in shafts through openings cut in the ceiling, its size, light and openings all as its {@link StudioDesign} has them, which the seed rolls and the world tuning changes, 8 × 8 m under a ceiling 8 m up by default, every work framed alike, in the Cell’s frame by default. */
export default class Studio extends Room {
  override readonly air: Box3
  /** where the floor and the faces of the north and west walls meet, relative to the room’s origin, which the Sandbox puts at the world’s origin */
  readonly corner: Vec3
  override readonly description = 'Four bare walls to snap and film things in.'
  override readonly fence: Geofence
  override readonly height: number
  override readonly id = 'studio'
  /** how the room is lit and its works are framed */
  readonly look: StudioLook
  /** the openings in the ceiling the moon falls through, and where its light lands on the floor */
  readonly openings: StudioOpenings
  /** how large the room is */
  readonly plan: StudioPlan
  override readonly size: FloorSize
  override readonly spawn: RoomSpawn
  /** the direction toward the moon */
  readonly toMoon: Vec3
  /** how thickly the air shows the shafts, which the world tuning changes live */
  override volumetricSun: number

  /**
   * @param design everything the room is built and lit from, the default environment’s by default
   * @param seed what rolls the openings the design names, the default environment’s by default
   */
  constructor(readonly design: StudioDesign = studioDesign(defaultSeed), seed = defaultSeed) {
    const plan = designPlan(design)
    const look = designLook(design)
    const {clear: [clearWidth, clearDepth], height} = plan
    /** the floor plan between the walls’ center lines, which the room’s size measures, round the clear floor */
    const size: FloorSize = [clearWidth + wallFace * 2, clearDepth + wallFace * 2]
    const corner: Vec3 = [-clearWidth / 2, 0, -clearDepth / 2]
    // The Cell’s walls, but for their cornice, which the plain ceiling does without.
    const wall = {
      baseboardHeight: sandboxBaseboardHeight,
      cornice: false,
    }
    super({
      title: 'Studio',
      cameras: {
        overview: {
          ...overview,
          position: [corner[0] + overview.position[0], overview.position[1], corner[2] + overview.position[2]],
        },
      },
      // One for all works, as the seed rolls it.
      frame: look.frame,
      map: studioMap(size),
      slots: studioSlots(plan.clear),
      // Both always there, so switching the secondary one on in the world tuning only brightens it.
      lamps: {
        [studioLampIds.primary]: studioLamp(look.lamps.primary),
        [studioLampIds.secondary]: studioLamp(look.lamps.secondary),
      },
      walls: {
        north: planWall(size, 'north', height, wall),
        east: planWall(size, 'east', height, wall),
        south: planWall(size, 'south', height, wall),
        west: planWall(size, 'west', height, wall),
      },
      // Nothing but the renderer’s clear black through the openings.
      skybox: null,
      volumetricSun: look.moon.shafts,
    })
    this.look = look
    this.plan = plan
    this.size = size
    this.volumetricSun = look.moon.shafts
    this.height = height
    this.air = floorBox(size, 0, height)
    this.fence = new Geofence([footprint([this.air])])
    this.corner = corner
    this.spawn = {
      ...arrival,
      position: [corner[0] + arrival.position[0], arrival.position[1], corner[2] + arrival.position[2]],
    }
    this.toMoon = moonDirectionOf(look)
    this.openings = studioOpenings(seed, this.toMoon, design.openings, {
      plan,
      variant: design.variant,
    })
  }

  /** how high the air reaches, up to the ceiling */
  get clearHeight() {
    return this.height
  }

  /** How high the air reaches over any point of the floor: up to the level ceiling. */
  ceilingAt(_x: number, _z: number) {
    return this.height
  }

  /** Whether the position, relative to the room’s origin, lies on the floor, at least `margin` meters from the walls’ center lines. */
  floorContains([x, , z]: Vec3, margin = 0) {
    const [width, depth] = this.size
    return Math.abs(x) <= width / 2 - margin && Math.abs(z) <= depth / 2 - margin
  }
}
