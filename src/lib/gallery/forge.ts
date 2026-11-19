import {wallFace} from './architectureDimensions.ts'
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

/** Enamel maker’s plate and task lights over the alchemy bench, relative to the room’s south wall. */
export const forgeBenchSign = {
  width: 2.7,
  height: 0.81,
  y: 3.75,
} as const
export const forgeBenchLamps = {
  y: 3.48,
  throwFromWall: 0.39,
  z: forge.size[1] / 2 - wallFace,
  sites: {
    bench_west: -2.22,
    bench_east: 2.22,
  },
} as const

const vestibuleRadius = 3
/** The round anteroom linking the Forge’s north wall to the Bastion’s approach. */
export const forgeVestibule = {
  center: [forge.center[0], northZ - vestibuleRadius],
  radius: vestibuleRadius,
} as const satisfies {
  center: readonly [number, number]
  radius: number
}

export default forge
