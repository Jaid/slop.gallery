import type {Wall} from '../placement/wallGeometry.ts'
import type {FloorRectangle} from './floors.ts'
import type {KnotLightSlot} from 'knot-materials/KnotLights.ts'

import {knotLightColor, knotLightHousingSize, knotLightHousingY} from 'knot-materials/KnotLightPanels.ts'

import {wallFace, wallOpeningTrim} from './architectureDimensions.ts'
import roomOrigins from './layout.ts'
import {plankTable} from './plankTable.ts'
import {salonSouthZ} from './salon.ts'

/** The Banquet’s floor plan, from the Salon’s south wall to the Vesper’s south wall’s line, and the height of its ceiling. */
export const banquet = {
  center: [roomOrigins.banquet[0], roomOrigins.banquet[2]],
  size: [12, 8 - salonSouthZ],
  height: 5.8,
} as const satisfies FloorRectangle & {height: number}
/** Underside of the 18 cm ceiling slab every upper-floor room gets 2 cm below its height, at 5.78 m in the Banquet. */
export const banquetCeilingUnderside = banquet.height - 0.02 - 0.18 / 2

/** Three Knottingham LED panes down the room’s middle, gathered 5 m apart around its center. */
export const banquetLedGrid = {
  x: [0],
  z: [-5, 0, 5],
}

/**
 * The color temperatures the Banquet’s panes can shine in, by the button that picks them, from top to bottom: the color of their lamps’ light, of their lit diffusers and of the button.
 * The panes balance the light and diffuser colors to the brightness of the white ones, so only the hue changes.
 */
export const banquetLightTemperatures = {
  white: {
    title: 'White light',
    light: '#eee3ff',
    surface: knotLightColor,
    button: '#f1eee6',
  },
  blue: {
    title: 'Blue light',
    light: '#b4caff',
    surface: '#a9c2ff',
    button: '#2f5fc4',
  },
  yellow: {
    title: 'Yellow light',
    light: '#ffbd6b',
    surface: '#ffbf5e',
    button: '#e8b522',
  },
} as const

/** how far below a pane’s origin its lamp hangs, just below its diffuser, close enough that the brightest ceiling spot stays hidden behind the housing */
export const banquetLedDrop = 0.32

/** the height of the panes’ origins above the floor; like Knottingham’s, each housing’s top sits 5 mm into the slab so no light leaks between them */
export const banquetLedY = banquetCeilingUnderside + 0.005 - knotLightHousingY - knotLightHousingSize[1] / 2
/** Breakable LED panes under the ceiling slab, one at each pair of the grid’s offsets from the room’s middle. */
export const banquetLedSlots: ReadonlyArray<KnotLightSlot> = banquetLedGrid.z.flatMap((z, row) => banquetLedGrid.x.map((x, slot) => ({
  id: `${row}:${slot}`,
  position: [banquet.center[0] + x, banquetLedY, banquet.center[1] + z],
  row,
  slot,
})))

/**
 * The long farmhouse table down the middle of the Banquet, in the room’s middle under its row of panes and as long as it, from the north end of the first housing to the south end of the last, on five pairs of legs.
 */
export const banquetTable = plankTable({
  length: banquetLedGrid.z.at(-1)! - banquetLedGrid.z[0] + knotLightHousingSize[2],
  width: 1.2,
  height: 0.77,
  top: 0.045,
  boards: 6,
  gap: 0.004,
  overhang: 0.05,
  apron: [0.13, 0.032],
  leg: 0.09,
  pairs: 5,
})

/** Edge length of the Banquet’s checkered marble tiles, laid from the room’s north-west corner: 12 × 24 whole tiles fill the floor. */
export const banquetFloorTile = 1
/** the room’s north-west corner in world x/z, where the tile grid starts */
export const banquetFloorOrigin = [banquet.center[0] - banquet.size[0] / 2, banquet.center[1] - banquet.size[1] / 2] as const

/** A rectangle on a wall, in its local coordinates: `u` along the wall from its center, `v` up from its floor, both in meters. */
export type WallRectangle = {
  u: readonly [number, number]
  v: readonly [number, number]
}

/**
 * Gilded boiserie on the Banquet’s painted walls, after the mockup: tall picture-frame panels above a chair rail, and a dado painted a
 * shade deeper below it. The dado between the 25 cm baseboard and the rail is too low for panels of its own; they would only
 * stack more gilt lines over the baseboard cap. All heights are measured from the floor, in meters.
 */
export const banquetBoiserie = {
  /** depth of the side walls’ faces, which take this much off both ends of every wall */
  corner: wallFace,
  /** room left between a corner and the first panel */
  cornerMargin: 0.38,
  /** room left between a doorway’s trim and the panels beside it */
  openingMargin: 0.34,
  /** gap between neighboring panels */
  gap: 0.36,
  /** no panel gets longer than this; longer runs are split into equal panels */
  maximumLength: 5.2,
  /**
   * the chair rail’s band; like the Salon’s, it stays low enough that the placards of the shipped frames clear it, and a
   * placard can only overlap it where a visitor hangs a work right down at the lowest allowed height
   */
  rail: [0.74, 0.79] as const,
  /** bottom and top of the panels; their tops stay a hand’s width under the cornice’s gilt band at 5.03 m */
  upper: [0.98, 4.76] as const,
  /** half the width of the gilt molding that frames each panel */
  moldingHalfWidth: 0.026,
  /** how far the molding stands proud of the plaster, for shading only */
  moldingDepth: 0.014,
} as const

/** Wall-local runs, from corner to corner, that are not taken by a doorway and its trim, each shortened by the given margins. */
export function freeWallRuns(wall: Pick<Wall, 'holes' | 'width'>, {corner: cornerMargin, opening: openingMargin}: {
  corner: number
  opening: number
} = {
  corner: banquetBoiserie.cornerMargin,
  opening: banquetBoiserie.openingMargin,
}) {
  const start = -wall.width / 2 + banquetBoiserie.corner + cornerMargin
  const end = wall.width / 2 - banquetBoiserie.corner - cornerMargin
  const blocked = (wall.holes ?? []).filter(hole => !hole.bottom).map(hole => [hole.u - hole.width / 2 - wallOpeningTrim - openingMargin, hole.u + hole.width / 2 + wallOpeningTrim + openingMargin] as const).toSorted((a, b) => a[0] - b[0])
  const runs: Array<readonly [number, number]> = []
  let cursor = start
  for (const [left, right] of blocked) {
    if (left > cursor) {
      runs.push([cursor, Math.min(left, end)])
    }
    cursor = Math.max(cursor, right)
  }
  if (end > cursor) {
    runs.push([cursor, end])
  }
  // A sliver beside a doorway is left as plain plaster.
  return runs.filter(([left, right]) => right - left >= 0.6)
}

/**
 * The boiserie of one of the Banquet’s walls, in wall-local coordinates: every free run is split into equal panels, and the chair rail
 * runs from corner to corner, stopping only at doorway trim.
 */
export function banquetWallPanels(wall: Pick<Wall, 'holes' | 'width'>) {
  const {gap, maximumLength, rail, upper} = banquetBoiserie
  const columns = freeWallRuns(wall).flatMap(([left, right]) => {
    const count = Math.ceil((right - left + gap) / (maximumLength + gap))
    const length = (right - left - gap * (count - 1)) / count
    return Array.from({length: count}, (_, index) => [left + index * (length + gap), left + index * (length + gap) + length] as const)
  })
  return {
    upper: columns.map((u): WallRectangle => ({
      u,
      v: upper,
    })),
    rails: freeWallRuns(wall, {
      corner: 0,
      opening: 0,
    }).map((u): WallRectangle => ({
      u,
      v: rail,
    })),
  }
}
