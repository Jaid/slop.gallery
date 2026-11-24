/** a round skylight in the ceiling, relative to the room’s origin: the middle of its opening on the floor plan, x and z, and the opening’s radius */
export type StudioSkylight = {
  center: readonly [x: number, z: number]
  radius: number
}

/**
 * The trim of the Studio’s round skylights, in meters, in the Cell’s plaster, walnut and gilt: the slab of the ceiling they pierce, the round recess each opens in the middle of, rising from the ceiling round a cove with a gilt bead along its edge, the molded walnut casing round each opening under the recess with a gilt bead in its groove, and the walnut sash glazed in the opening near the slab’s top, a ring round two bars either way, which split it into three rows of three panes, gilt bosses where they cross.
 */
export const studioSkylightTrim = {
  /** how thick the ceiling’s slab is over its underside, which the recesses and the openings’ plaster reveals rise into */
  slab: 0.45,
  recess: {
    /** how far out from the opening its edge runs */
    reach: 0.8,
    /** how high it rises into the slab */
    rise: 0.2,
    /** the radius of the cove from its edge up to its level ceiling */
    cove: 0.2,
    /** the radius of the round section of the gilt bead along its edge, half sunk into the ceiling */
    bead: 0.022,
  },
  casing: {
    /** how far it reaches out from the opening */
    width: 0.26,
    /** how far it hangs under the recess’s ceiling */
    drop: 0.075,
    /** the radius of the gilt bead’s round section */
    bead: 0.016,
  },
  sash: {
    /** how wide the ring round the panes is, in from the opening */
    frame: 0.08,
    /** how wide the bars between the panes are */
    bar: 0.06,
    /** how deep both are */
    depth: 0.08,
    /** how far under the slab’s top they end */
    top: 0.04,
    /** how round their edges are */
    radius: 0.006,
    /** the radius of the bosses where the bars cross */
    boss: 0.045,
  },
} as const

/** How far the middles of a skylight’s bars lie either way from the middle of an opening `radius` meters wide: a third of the panes’ diameter apart, splitting it into three equal parts. */
export function skylightBars(radius: number) {
  const panes = radius - studioSkylightTrim.sash.frame
  return [-panes / 3, panes / 3] as const
}
