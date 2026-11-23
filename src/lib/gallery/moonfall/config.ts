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

/** the ceiling slab relative to Moonfall’s floor */
export const ceilingSlab = {
  // The highest slab that stays clear of the upper floor, whose underside is at world y = −0.24.
  center: 7.59,
  thickness: 0.18,
} as const
/** the face of the smoked mirror lining, 1 cm below the slab that still casts shadows during the reflection pass */
export const ceilingMirrorY = ceilingSlab.center - ceilingSlab.thickness / 2 - 0.01
