import {wallFace, wallTop} from './architectureDimensions.ts'

/** a section of the ceiling across one of its sides: how far in from the walls’ faces, and how high */
export type CeilingSection = readonly [inward: number, y: number]

/**
 * The Vesper’s coved ceiling and the twin glazed lanterns that crown it, in meters relative to the room’s middle at floor level.
 *
 * A flat ledge runs around the room on top of the walls. From its edge, a cove curves up and in like a quarter ellipse to a flat band that frames the two openings. The coves of the four sides meet on the diagonals, as in a cloister vault.
 * Gilt fillets line the edge of the ledge, the top of the cove and the openings, and gilt beads follow the creases where the coves meet.
 * A bridge spans the middle. A low curb rises around each opening and carries a lantern: upright sides and a hipped roof, all of cast glass held by bronze bars, which lets the sun in.
 */
const vesperCeiling = {
  springY: wallTop,
  /** The ledge reaches past the shell of the Lobby’s vault, which overhangs the wall the two rooms share by 34 cm, so the cove never meets it. */
  ledge: 0.45,
  cove: {
    run: 1.6,
    rise: 1.4,
    /** segments along its quarter ellipse */
    segments: 24,
  },
  /** how far the lantern’s opening keeps from the walls’ center lines on every side */
  inset: 3,
  /** height of the curb around the opening, which the lantern stands on */
  curb: 0.3,
  gilt: {
    /** width of the fillets along the edges and the top of the cove */
    fillet: 0.07,
    /** radius of the beads in the creases of the cove */
    bead: 0.028,
  },
  /** width along z of the bridge separating the glasshouses: two bays of the glazing grid */
  bridgeWidth: 2,
  lantern: {
    /** height of the upright glazed sides */
    side: 1,
    /** how far the ridge rises above the eaves */
    rise: 1.25,
    /** rows of panes up every slope of the roof */
    rows: 3,
    /** width of the panes along the sides and the eaves */
    pane: 1,
    /** glazing bars between the panes: width across them and depth into the lantern */
    bar: [0.04, 0.06],
    /** the heavier sill, eaves plate, corner posts, hips and ridge */
    frame: [0.08, 0.1],
    /** gap between the glass and the bars inside it */
    gap: 0.005,
  },
} as const

/** Height of the top of the cove and of the flat band around the opening. */
export const vesperCoveTopY = vesperCeiling.springY + vesperCeiling.cove.rise
/** Height of the curb’s top, where the lantern’s glass starts. */
export const vesperLanternSillY = vesperCoveTopY + vesperCeiling.curb
/** Height where the upright glass meets the roof. */
export const vesperLanternEavesY = vesperLanternSillY + vesperCeiling.lantern.side
/** Height of the lantern’s ridge, the highest point of the room. */
export const vesperLanternRidgeY = vesperLanternEavesY + vesperCeiling.lantern.rise
/** How far in from the walls’ faces the cove ends and the flat band begins. */
export const vesperCoveEnd = vesperCeiling.ledge + vesperCeiling.cove.run
/** How far in from the walls’ faces the opening starts. */
export const vesperOpeningInset = vesperCeiling.inset - wallFace

/** Half extents and z offsets of the two equal hipped lanterns, relative to the center of the room. */
export function vesperLanternLayout([width, depth]: readonly [number, number]) {
  const {bridgeWidth, inset} = vesperCeiling
  const half = [width / 2 - inset, (depth - 2 * inset - bridgeWidth) / 4] as const
  if (!(half[0] > 0 && half[1] > half[0])) {
    throw new RangeError('Each of the Vesper’s lanterns needs a clear span and a longitudinal ridge.')
  }
  const offset = half[1] + bridgeWidth / 2
  return {
    half,
    centers: [-offset, offset] as const,
  }
}

/** The cove’s section at `angle`, from 0 where it rises upright from the ledge to π/2 where it meets the band level, with its normal toward the room. */
export function vesperCoveSection(angle: number) {
  const {cove, ledge, springY} = vesperCeiling
  const point: CeilingSection = [ledge + cove.run * (1 - Math.cos(angle)), springY + cove.rise * Math.sin(angle)]
  const normal = [cove.rise * Math.cos(angle), -cove.run * Math.sin(angle)] as const
  const length = Math.hypot(...normal)
  return {
    point,
    normal: [normal[0] / length, normal[1] / length] as CeilingSection,
  }
}

export default vesperCeiling
