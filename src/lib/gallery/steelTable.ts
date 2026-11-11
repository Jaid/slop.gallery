import type {Vec3} from './types.ts'

/**
 * A heavy workshop table: one thick steel slab for a top, on square steel legs tied together by rails under the top and a stretcher along each side.
 * It runs along z in its own frame, its `height` is the top’s upper face over the floor, and all values are in meters.
 * Its legs and stretchers are set in by `legInset` from the top’s edges all round, so a table pushed close to a wall can keep every part that reaches the floor clear of the wall’s baseboard.
 */
export type SteelTable = {
  /** how deep its rails reach below the top, and how thick they are */
  apron: readonly [depth: number, thickness: number]
  height: number
  /** the side of its square legs */
  leg: number
  /** how far its legs and stretchers stand in from the top’s edges */
  legInset: number
  /** where along it from its middle its pairs of legs stand */
  legs: ReadonlyArray<number>
  /** how far either leg of a pair stands from its middle across it */
  legX: number
  length: number
  /** how far its top overhangs its rails all round */
  overhang: number
  /** how thick its steel top is */
  top: number
  width: number
}

/** a box a collider takes up: where its middle lies and how large it is */
export type SteelColliderBox = {
  center: Vec3
  name: string
  size: Vec3
}

/** the stretchers along each side of a steel table, low between its legs: how thick and high they are and how high their middle stands */
export const steelStretcher = {
  thickness: 0.028,
  height: 0.07,
  y: 0.3,
} as const

/** A steel table of the size with `pairs` pairs of legs, one at either end and evenly between them so a long top never sags. */
export function steelTable({pairs, ...table}: Omit<SteelTable, 'legs' | 'legX'> & {pairs: number}): SteelTable {
  const {leg, legInset, length, width} = table
  if (!(pairs >= 2)) {
    throw new RangeError('A steel table needs at least two pairs of legs.')
  }
  const reach = length / 2 - legInset - leg / 2
  return {
    ...table,
    legX: width / 2 - legInset - leg / 2,
    legs: Array.from({length: pairs}, (_, index) => (index * 2 / (pairs - 1) - 1) * reach),
  }
}

/** The table’s colliders, named after it, in its frame on the floor under its middle: its top with the rails under it, each of its legs, and the stretchers along its sides. */
export function steelTableColliders({apron: [apronDepth], height, leg, legs, legX, length, top, width}: SteelTable, name: string): Array<SteelColliderBox> {
  const slab = top + apronDepth
  const legHeight = height - slab
  const span = legs.at(-1)! - legs[0]
  return [
    {
      name: `${name}-top`,
      center: [0, height - slab / 2, 0],
      size: [width, slab, length],
    },
    ...legs.flatMap(z => [-1, 1].map((side): SteelColliderBox => ({
      name: `${name}-leg`,
      center: [side * legX, legHeight / 2, z],
      size: [leg, legHeight, leg],
    }))),
    ...[-1, 1].map((side): SteelColliderBox => ({
      name: `${name}-stretcher`,
      center: [side * legX, steelStretcher.y, 0],
      size: [steelStretcher.thickness, steelStretcher.height, span],
    })),
  ]
}
