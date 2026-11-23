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

// Flush with the underside of the ground floor’s slabs overhead: under the Lobby’s south end, the Antechamber, the Sienna and its vestibule. Nothing of the stairs hangs under it.
const top = -floorThickness - lowerGallery.floorY
const thickness = 0.18
/** the ceiling slab relative to Moonfall’s floor */
export const ceilingSlab = {
  center: top - thickness / 2,
  thickness,
} as const
/** Height at which the walls meet the middle of the slab. */
export const moonfallHeight = ceilingSlab.center
/** the face of the smoked mirror lining, 1 cm below the slab that still casts shadows during the reflection pass */
export const ceilingMirrorY = ceilingSlab.center - ceilingSlab.thickness / 2 - 0.01
