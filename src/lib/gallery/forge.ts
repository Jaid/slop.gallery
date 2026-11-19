import {ironTable} from './ironTable.ts'
import salon from './salon.ts'

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
  depth: 1.3,
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
  const angle = 19 * Math.PI / 180
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

/** The brass gauge let flush into the floor down both sides of the aisle, in meters: a strip out from the room’s axis, with ticks reaching out from it every decimeter, farther every half meter and meter. */
export const forgeGauge = {
  /** how far out from the room’s axis the strip runs */
  offset: 1.05,
  /** how wide the strip is */
  strip: 0.032,
  /** the spacing of each division of ticks, and how far they reach out from the strip’s middle */
  ticks: [[0.1, 0.056], [0.5, 0.115], [1, 0.18]],
  /** how far short of the north and south walls’ center lines it ends */
  inset: 0.23,
} as const

/** The south-facing sawtooth lights. Heights are measured from the workshop floor. */
export const forgeRoof = {
  /** how many teeth span the room from north to south, each over an equal share of its length */
  bays: 3,
  /** the height of the valleys between the teeth and of the roof’s foot over the north and south walls */
  eave: 5.72,
  /** the height of the ridges, where the sheeted pitch turns down into the glass */
  ridge: 7.68,
  /** how far each tooth’s glass reaches north of its valley, in plan */
  glassRun: 1.55,
  // The Lobby vault’s outer shell overhangs the shared wall. Seat the east gables on a box girder inside its springing.
  eastSetback: 0.55,
  /** how many panes the glazing bars split each light into across the room */
  panesAcross: 8,
} as const

/** The three pitches and the lines of their iron columns, relative to the floor center. */
export const forgeBays = Array.from({length: forgeRoof.bays}, (_, i) => {
  const bay = forge.size[1] / forgeRoof.bays
  const north = -forge.size[1] / 2 + i * bay
  const south = north + bay
  return {
    north,
    south,
    peak: south - forgeRoof.glassRun,
  }
})
/** how wide the bearings under the ridges are along the walls: of the iron columns on the west floor and of the posts on the box girder over the Lobby window */
export const forgePierWidth = 0.45

const vestibuleRadius = 3
/**
 * The vestibule north of the Forge, still the Forge’s: a round anteroom at its floor on its axis, whose wall touches the middle of its north wall back to back, where an arch opens through both into the room.
 * The Bastion’s approach arrives through a second arch, from the west. Over it rises a fluted smoke hood of zinc to a bull’s-eye of opal wired glass round a brass hub.
 */
export const forgeVestibule = {
  center: [forge.center[0], northZ - vestibuleRadius],
  /** the radius of its wall’s center line */
  radius: vestibuleRadius,
  /** the height of the top of its hood’s hub over the floor */
  crown: 6.44,
} as const satisfies {
  center: readonly [number, number]
  crown: number
  radius: number
}

export default forge
