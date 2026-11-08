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
