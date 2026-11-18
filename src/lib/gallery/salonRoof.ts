import {salonCeiling} from './salon.ts'

/** The Salon’s oval saucer and rooflight, in meters relative to the room’s center. */
const salonRoof = {
  springY: salonCeiling.underside,
  /** semi-axes where the plaster starts to rise */
  spring: [5.08, 6.58],
  rise: 1.02,
  flutes: 24,
  /** semi-axes of the clear opening at the top of the plaster */
  opening: [3.02, 4.32],
  /** height of the glass above the head of the cove */
  curb: 0.15,
  petals: 8,
  /** fraction of the opening’s radius where the perimeter panes begin */
  border: 0.85,
} as const

export const salonGlassY = salonRoof.springY + salonRoof.rise + salonRoof.curb
export const salonRoofTopY = salonGlassY + 0.065

export default salonRoof
