import {floorThickness} from '../floors.ts'
import lowerGallery from '../lowerGallery.ts'

export const moonfallCrater = {
  radius: 9,
  depth: 3.6,
  fenceRadius: 10,
  /** the fewest and the most stanchions around the crater, between which the environment seed draws their number */
  fencePosts: [16, 32],
  /** how low the middles of the ropes hang with the fewest and with the most stanchions, as shares of the stanchions’ height */
  fenceLowest: [0.75, 0.25],
  /** vertices on the cut edge, shared by the terrain, the floor’s hole and the gold trim */
  rimSegments: 128,
  /** largest vertical deviation of the low-poly terrain from its height field at any sample */
  terrainTolerance: 0.08,
  /** spacing of the height field samples that may become terrain vertices */
  terrainSpacing: 0.07,
} as const

const ceilingThickness = 0.18
/** top of Moonfall’s ceiling slab relative to its floor, flush against the underside of the ground-floor slabs above (−floorThickness) */
const ceilingTop = -floorThickness - lowerGallery.floorY

/** the ceiling slab relative to Moonfall’s floor, raised as high as the ground-floor slabs allow */
export const ceilingSlab = {
  center: ceilingTop - ceilingThickness / 2,
  thickness: ceilingThickness,
} as const

/** clear height from Moonfall’s floor up to the ceiling slab’s underside (+189 cm above the former 5.69 m underside) */
export const moonfallHeight = ceilingTop - ceilingThickness

/** the face of the smoked mirror lining, 1 cm below the slab that still casts shadows during the reflection pass */
export const ceilingMirrorY = moonfallHeight - 0.01

/** Moonfall’s ceiling beams: 40 cm deep, tucked 1 cm into the slab underside, clearing the walls’ cornice below */
export const ceilingBeam = {
  height: 0.4,
  width: 0.16,
  centerY: moonfallHeight + 0.01 - 0.2,
  bottomY: moonfallHeight + 0.01 - 0.4,
} as const
