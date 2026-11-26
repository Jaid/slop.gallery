import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'
import type {StudioFloorId, StudioWallId} from './finishes.ts'
import type {StudioLamp, StudioLook} from './look.ts'
import type {StudioOpeningsChoice} from './openings/openingParameter.ts'
import type {StudioPlan} from './plan.ts'
import type {Vec3} from 'math'

import {readRoomSize} from '#src/worlds/sandbox/roomSize.ts'

import {studioFloorId, studioWallId} from './finishes.ts'
import {studioLook} from './look.ts'
import {studioOpeningStyle} from './openings/index.ts'
import {forcedOpenings} from './openings/openingParameter.ts'
import {studioPlan} from './plan.ts'
import {onStep, studioSteps} from './steps.ts'

/**
 * Everything the Studio is built and lit from, value by value, which every seed rolls anew but the default one and the world tuning changes: its size, the openings in its ceiling, the moon or sun falling through them, its two lamps, its fill, its finishes and its frame.
 * Positions are in meters from the north-western corner of the floor, which the Sandbox puts at the world’s origin, so they read as world coordinates, but the secondary lamp’s, which are shares of the room’s width, depth and height, so it keeps its place in a room of another size.
 */
export type StudioDesign = {
  /** the fill’s ambient light */
  ambient: number
  /** the clear floor from the north wall to the south wall, in meters */
  depth: number
  /** the floor’s finish */
  floor: StudioFloorId
  /** the frame every work in the room hangs in */
  frame: PortraitFrameId
  /** how high the walls rise, and the ceiling over them hangs, in meters */
  height: number
  /** the fill’s hemisphere light */
  hemisphere: number
  /** where the moon or sun stands, in degrees clockwise from north */
  lightAzimuth: number
  /** how widely the shadow’s edges blur, as a factor on the graphics mode’s */
  lightBlur: number
  /** the moon’s or the sun’s, as packed sRGB */
  lightColor: number
  /** how high the moon or sun stands, in degrees over the horizon */
  lightElevation: number
  /** how thickly the air shows its shafts, the room’s volumetric sun */
  lightShafts: number
  /** how strongly it shines on what it falls on */
  lightStrength: number
  /** a factor on the floor finish’s reflectance */
  mirror: number
  /** the radius of the floor mirror’s blur in pixels of a 1080-row image, or {@link ownMirrorBlur} for the finish’s own */
  mirrorBlur: number
  /** a factor on the floor finish’s loss, how coarse a mip of the mirror it reads: 0 for its full resolution, 1 for the finish’s own */
  mirrorLoss: number
  /** the kind of openings cut through the ceiling, or none for a plain one */
  openings: StudioOpeningsChoice
  /** how wide the primary lamp’s shadow’s edges blur, in degrees seen from it, or 0 to blur as every lamp’s do */
  primaryLampBlur: number
  /** as packed sRGB */
  primaryLampColor: number
  primaryLampDecay: number
  /** over the floor, in meters */
  primaryLampHeight: number
  /** how far it reaches, in meters, or 0 for no end */
  primaryLampRange: number
  /** in candela */
  primaryLampStrength: number
  /** east of the west wall, in meters */
  primaryLampX: number
  /** south of the north wall, in meters */
  primaryLampZ: number
  /** how wide the secondary lamp’s shadow’s edges blur, in degrees seen from it, or 0 to blur as every lamp’s do */
  secondaryLampBlur: number
  /** as packed sRGB */
  secondaryLampColor: number
  secondaryLampDecay: number
  /** over the floor, as a share of the room’s height */
  secondaryLampHeight: number
  /** how far it reaches, in meters, or 0 for no end */
  secondaryLampRange: number
  /** in candela, or 0 for off */
  secondaryLampStrength: number
  /** east of the west wall, as a share of the room’s width */
  secondaryLampX: number
  /** south of the north wall, as a share of the room’s depth */
  secondaryLampZ: number
  /** which chain of rolls cuts them: 0 for the seed’s own, any other for one of its own */
  variant: number
  /** the walls’ finish */
  walls: StudioWallId
  /** the clear floor from the west wall to the east wall, in meters */
  width: number
}

/** the {@link StudioDesign.mirrorBlur} that keeps the floor finish’s own blur */
export const ownMirrorBlur = -1

const roomSize = readRoomSize()
const round = (value: number) => Math.round(value * 100) / 100
const share = (value: number) => onStep(value, studioSteps.lampShare)
/** The lamp of the design, the primary or the secondary one, at the point, relative to the middle of the floor. */
const lampOf = (design: StudioDesign, lamp: 'primary' | 'secondary', position: Vec3): StudioLamp => ({
  blur: design[`${lamp}LampBlur`],
  decay: design[`${lamp}LampDecay`],
  position,
  range: design[`${lamp}LampRange`],
  strength: design[`${lamp}LampStrength`],
  tint: design[`${lamp}LampColor`],
})

/** The Studio’s seeded design, with `?room_width`, `?room_depth` and `?room_height` overriding its size and `?openings` its kind of ceiling openings. */
export function studioDesign(seed: number, forced = forcedOpenings, size = roomSize): StudioDesign {
  const {clear: [width, depth], height} = studioPlan(seed)
  const {fill, floor, frame, lamps: {primary, secondary}, moon} = studioLook(seed)
  return {
    width: size.width ?? width,
    depth: size.depth ?? depth,
    height: size.height ?? height,
    openings: studioOpeningStyle(seed, forced),
    variant: 0,
    lightColor: moon.color,
    lightAzimuth: moon.azimuth,
    lightElevation: moon.elevation,
    lightStrength: moon.intensity,
    lightShafts: moon.shafts,
    lightBlur: moon.blur,
    primaryLampStrength: primary.strength,
    primaryLampColor: primary.tint,
    primaryLampDecay: primary.decay,
    primaryLampX: round(primary.position[0] + width / 2),
    primaryLampZ: round(primary.position[2] + depth / 2),
    primaryLampHeight: primary.position[1],
    primaryLampRange: primary.range,
    primaryLampBlur: primary.blur,
    secondaryLampStrength: secondary.strength,
    secondaryLampColor: secondary.tint,
    secondaryLampDecay: secondary.decay,
    secondaryLampX: share(secondary.position[0] / width + 0.5),
    secondaryLampZ: share(secondary.position[2] / depth + 0.5),
    secondaryLampHeight: share(secondary.position[1] / height),
    secondaryLampRange: secondary.range,
    secondaryLampBlur: secondary.blur,
    ambient: fill.ambient,
    hemisphere: fill.hemisphere,
    walls: studioWallId(seed),
    floor: studioFloorId(seed),
    mirror: floor.strength,
    mirrorBlur: floor.blur ?? ownMirrorBlur,
    mirrorLoss: floor.loss,
    frame,
  }
}

/** How large the Studio of the design is. */
export function designPlan({depth, height, width}: StudioDesign): StudioPlan {
  return {
    clear: [width, depth],
    height,
  }
}

/** How the Studio of the design is lit and its works are framed, its lamps placed relative to the middle of its floor. */
export function designLook(design: StudioDesign): StudioLook {
  const {depth, height, width} = design
  return {
    fill: {
      ambient: design.ambient,
      hemisphere: design.hemisphere,
    },
    floor: {
      blur: design.mirrorBlur === ownMirrorBlur ? undefined : design.mirrorBlur,
      loss: design.mirrorLoss,
      strength: design.mirror,
    },
    frame: design.frame,
    lamps: {
      primary: lampOf(design, 'primary', [design.primaryLampX - width / 2, design.primaryLampHeight, design.primaryLampZ - depth / 2]),
      secondary: lampOf(design, 'secondary', [(design.secondaryLampX - 0.5) * width, design.secondaryLampHeight * height, (design.secondaryLampZ - 0.5) * depth]),
    },
    moon: {
      azimuth: design.lightAzimuth,
      blur: design.lightBlur,
      color: design.lightColor,
      elevation: design.lightElevation,
      intensity: design.lightStrength,
      shafts: design.lightShafts,
    },
  }
}
