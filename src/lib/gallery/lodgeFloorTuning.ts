import {lodgeFloorOil} from './lodge.ts'

/** The finish of the Lodge’s oiled planks, which the tuning panel of `?development` changes live while they mirror the room. */
export type LodgeFloorTuning = {
  /** the radius of the Gaussian blur over the mirror, in pixels of a 1080-row image; 0 leaves it sharp */
  lodgeFloorBlur: number
  /** the environment’s share of the lighting */
  lodgeFloorEnvironment: number
  /** extra reflectance at grazing angles */
  lodgeFloorGrazing: number
  /** the mip level the mirror is read at, 0 being its full resolution and every step halving it */
  lodgeFloorLoss: number
  /** reflectance looking straight down, where 0 leaves the planks unmirrored */
  lodgeFloorReflection: number
  /** the boards’ roughness, which shapes their highlights and environment light but not their mirror */
  lodgeFloorRoughness: number
}

/** The values the Lodge’s planks are finished with. */
export function getLodgeFloorTuning(): LodgeFloorTuning {
  return {
    lodgeFloorBlur: lodgeFloorOil.reflection.gaussianBlur,
    lodgeFloorEnvironment: lodgeFloorOil.envMapIntensity,
    lodgeFloorGrazing: lodgeFloorOil.reflection.grazingStrength,
    lodgeFloorLoss: lodgeFloorOil.reflection.loss,
    lodgeFloorReflection: lodgeFloorOil.reflection.strength,
    lodgeFloorRoughness: lodgeFloorOil.roughness.mirrored,
  }
}
