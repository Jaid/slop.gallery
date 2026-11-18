import {wallFace, wallTop} from './architectureDimensions.ts'

/** a section of the ceiling across one of its sides: how far in from the walls’ faces, and how high */
export type CeilingSection = readonly [inward: number, y: number]

/** one of the two glazed roof lanterns flanking the central bridge */
export type VesperLantern = {
  /** offset of the lantern’s middle along z relative to the room’s middle */
  centerZ: number
  /** half-extent of the lantern’s opening along x and z */
  half: readonly [number, number]
}

/**
 * The Vesper’s coved ceiling, its central bridge and the two glazed lanterns that crown it, in meters relative to the room’s middle at floor level.
 *
 * A flat ledge runs around the room on top of the walls. From its edge, a cove curves up and in like a quarter ellipse to a flat band that frames the ceiling opening. The coves of the four sides meet on the diagonals, as in a cloister vault.
 * Gilt fillets line the edge of the ledge, the top of the cove and each opening, and gilt beads follow the creases where the coves meet.
 * A low curb rises around each half of the opening and carries a lantern: upright sides and a hipped roof, all of cast glass held by bronze bars, which lets the sun in.
 * Across the middle of the opening spans an arched, coffered bridge springing from sculpted corbelled piers on the flat ceiling band, with pierced spandrel oculi and colonnettes below a corniced deck.
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
  /** how far the outer opening keeps from the walls’ center lines on every side */
  inset: 3,
  /** height of the curb around the openings, which the lanterns stand on */
  curb: 0.3,
  gilt: {
    /** width of the fillets along the edges and the top of the cove */
    fillet: 0.07,
    /** radius of the beads in the creases of the cove */
    bead: 0.028,
  },
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
  bridge: {
    /** half-width of the bridge deck along z, splitting the 18 m opening into two 6 m × 8 m lanterns */
    halfWidth: 1,
    arch: {
      /** height of the arch intrados where it springs from the abutment piers */
      springY: 6.12,
      /** height of the arch intrados at the crown */
      crownY: 7.04,
      /** thickness of the arch barrel; at the crown its extrados meets the underside of the deck */
      thickness: 0.18,
      /** half-width of the arch barrel along z */
      halfWidth: 0.92,
      /** depth of the four coffers recessed into the arch’s underside */
      cofferDepth: 0.06,
      /** width of the plaster ribs framing the coffers */
      ribWidth: 0.22,
      /** segments along the full arch span */
      segments: 48,
    },
    deck: {
      /** height of the deck’s underside over the open spandrels */
      bottomY: 7.22,
      /** height of the projecting deck cornice */
      corniceHeight: 0.055,
      /** how far the deck cornice projects past the deck’s north and south faces */
      corniceOverhang: 0.03,
    },
    pier: {
      /** inner face of the abutment pier neck */
      faceX: 3.14,
      /** outer edge of the corbel bracket on the flat ceiling band, cleanly clear of the cove-top fillet */
      tailX: 3.64,
      /** height of the pier’s impost base above the floor */
      baseY: 6.04,
      /** half-width of the pier along z, inset inside the deck cornice */
      halfWidth: 0.96,
    },
    keystone: {
      halfWidth: 0.22,
      /** how far the keystone drops below the arch’s crown */
      drop: 0.06,
      /** how far the keystone stands proud of the arch’s north and south faces */
      overhangZ: 0.04,
    },
  },
} as const

/** Height of the top of the cove and of the flat band around the opening. */
export const vesperCoveTopY = vesperCeiling.springY + vesperCeiling.cove.rise
/** Height of the curb’s top, where the lanterns’ glass starts. */
export const vesperLanternSillY = vesperCoveTopY + vesperCeiling.curb
/** Height where the upright glass meets the roof. */
export const vesperLanternEavesY = vesperLanternSillY + vesperCeiling.lantern.side
/** Height of the lanterns’ ridges, the highest point of the room. */
export const vesperLanternRidgeY = vesperLanternEavesY + vesperCeiling.lantern.rise
/** How far in from the walls’ faces the cove ends and the flat band begins. */
export const vesperCoveEnd = vesperCeiling.ledge + vesperCeiling.cove.run
/** How far in from the walls’ faces the outer opening starts. */
export const vesperOpeningInset = vesperCeiling.inset - wallFace

/** Half the extent of the outer ceiling opening along x and z in a room of the size. */
export function vesperLanternHalf([width, depth]: readonly [number, number]) {
  const half = [width / 2 - vesperCeiling.inset, depth / 2 - vesperCeiling.inset] as const
  if (!(half[0] > 0) || half[1] < half[0]) {
    throw new RangeError('The Vesper’s lantern needs a room wider than twice its inset and at least as deep as it is wide.')
  }
  return half
}

/** The two glazed lanterns on the north and south sides of the central bridge in a room of the size. */
export function vesperLanterns(size: readonly [number, number]): readonly [VesperLantern, VesperLantern] {
  const [halfX, totalHalfZ] = vesperLanternHalf(size)
  const {halfWidth} = vesperCeiling.bridge
  const halfZ = (totalHalfZ - halfWidth) / 2
  if (halfZ < halfX) {
    throw new RangeError('The Vesper’s split lanterns need enough length on either side of the bridge to stay at least as deep as they are wide.')
  }
  const offset = halfWidth + halfZ
  return [
    {
      centerZ: -offset,
      half: [halfX, halfZ],
    },
    {
      centerZ: offset,
      half: [halfX, halfZ],
    },
  ]
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
