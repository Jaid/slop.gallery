import {ironTable} from './ironTable.ts'
import salon, {salonCeiling} from './salon.ts'

/**
 * A round rooflight: a disc of clear cast glass open to the sky, held in a square grid of bars and framed by a deep ring of plaster hanging below the slab, like the eye of a Roman dome let into a flat ceiling.
 * All values are in meters, relative to its middle.
 */
export type Rooflight = {
  barDepth: number
  barWidth: number
  /** the gilt bead along the ring’s lower inner edge */
  bead: number
  /** how far the ring hangs below the ceiling */
  depth: number
  /** width of the plaster ring around the opening */
  frame: number
  /** the glass sits 1 cm below the slab, above the glazing bars */
  glassY: number
  /** glazing bars split the glass into square panes of this size, a whole number of them across the opening */
  pane: number
  /** radius of the glazed opening cut through the slab */
  radius: number
}

/**
 * The Forge sits north of the Vesper, across the Lobby’s north extension from the Salon, whose floor plan it mirrors: its east wall backs onto the Lobby’s west extension, from the Lobby’s north wall to the Vesper’s north wall’s line.
 * The Bastion climbs from the Oculus’ west bridge and enters its round vestibule, north of the room, from the west.
 */
const forge = {
  center: [-salon.center[0], salon.center[1]],
  size: salon.size,
} as const satisfies {
  center: readonly [number, number]
  size: readonly [number, number]
}
const northZ = forge.center[1] - forge.size[1] / 2

/** The dimensions of each Forge table, in meters. */
export const forgeTableSize = {
  depth: 1.2,
  height: 1.2,
  length: 5,
} as const

/** The soapstone-topped iron tables flanking the central aisle. */
export const forgeTable = ironTable({
  ...forgeTableSize,
  top: 0.05,
  overhang: 0.14,
  back: 0.12,
  apron: [0.1, 0.012],
  leg: 0.06,
  stretcher: [0.12, 0.035],
  pairs: 2,
})
/** The four outer tables fan out toward the open space halfway down the room. */
function outerTable(side: -1 | 1, end: -1 | 1) {
  const angle = Math.PI / 9
  return {
    // Leave a walking gap between the facing ends on each side.
    center: [forge.center[0] + side * 3.25, forge.center[1] + (end < 0 ? -3.81 : 2.2)] as const,
    name: `${side < 0 ? 'forge-table' : 'forge-side-table'}-${end < 0 ? 'north' : 'south'}`,
    seed: (side < 0 ? 5303 : 7411) + end,
    turn: side * (Math.PI / 2 - end * angle),
  }
}
const painter = outerTable(-1, -1)
const palette = outerTable(1, -1)
export const forgeRowTables = [painter, outerTable(-1, 1), palette, outerTable(1, 1)]

/** The painting set and palette knife rest on the two tables nearest the north entrance. */
export const {center: forgeTableCenter, turn: forgeTableTurn} = painter
export const {center: forgeSideTableCenter, turn: forgeSideTableTurn} = palette
export const forgeSideTable = forgeTable

/** The round rooflight in the middle of the ceiling, relative to the room’s center. */
export const forgeRooflight = {
  radius: 2.5,
  frame: 0.55,
  depth: 0.34,
  pane: 1,
  barWidth: 0.05,
  barDepth: 0.07,
  glassY: salonCeiling.underside - 0.01,
  bead: 0.04,
} as const satisfies Rooflight

const vestibuleRadius = 3
/**
 * The vestibule north of the Forge, still the Forge’s: a round anteroom at its floor on its axis, whose wall touches the middle of its north wall back to back, where an arch opens through both into the room.
 * The Bastion’s approach arrives through a second arch, from the west. Its ceiling is as high as the room’s, pierced in the middle by a round rooflight of its own.
 */
export const forgeVestibule = {
  center: [forge.center[0], northZ - vestibuleRadius],
  /** the radius of its wall’s center line */
  radius: vestibuleRadius,
  /** relative to the vestibule’s center: a smaller eye than the room’s, in panes half as large */
  rooflight: {
    radius: 1,
    frame: 0.4,
    depth: 0.26,
    pane: 0.5,
    barWidth: 0.04,
    barDepth: 0.06,
    glassY: salonCeiling.underside - 0.01,
    bead: 0.03,
  },
} as const satisfies {
  center: readonly [number, number]
  radius: number
  rooflight: Rooflight
}

export default forge
