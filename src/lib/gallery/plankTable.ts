import type {Vec3} from './types.ts'

/**
 * A table of planks running its length, on square legs tied together by aprons round its sides and ends and a cross rail at every pair of legs between the ends. It runs along z, its `height` is the top’s upper face over the floor, all in meters.
 */
export type PlankTable = {
  /** how deep its aprons reach below the top, and how thick they are */
  apron: readonly [depth: number, thickness: number]
  /** how many planks lie side by side across it */
  boards: number
  /** the gap between two of its planks */
  gap: number
  height: number
  /** the side of its square legs */
  leg: number
  /** where along it from its middle its pairs of legs stand */
  legs: ReadonlyArray<number>
  /** how far either leg of a pair stands from its middle across it */
  legX: number
  length: number
  /** how far its top overhangs its aprons and legs all round */
  overhang: number
  /** how thick its planks are */
  top: number
  width: number
}
/** a box a collider takes up: where its middle lies and how large it is */
export type ColliderBox = {
  center: Vec3
  name: string
  size: Vec3
}

/** how far a table’s legs stand back from the faces of its aprons, so their faces never fight */
const legInset = 0.003

/** A table of the size with `pairs` pairs of legs, one at either end and evenly between them so a long top never sags. */
export function plankTable({pairs, ...table}: Omit<PlankTable, 'legs' | 'legX'> & {pairs: number}): PlankTable {
  const {leg, length, overhang, width} = table
  const reach = length / 2 - overhang - leg / 2 - legInset
  return {
    ...table,
    legX: width / 2 - overhang - leg / 2 - legInset,
    legs: Array.from({length: pairs}, (_, index) => (index * 2 / (pairs - 1) - 1) * reach),
  }
}

/** The table’s colliders, named after it, in its frame on the floor under its middle: its top with the aprons under it, solid down to their bottom, and each of its legs. */
export function plankTableColliders({apron: [apronDepth], height, leg, legs, legX, length, top, width}: PlankTable, name: string): Array<ColliderBox> {
  const slab = top + apronDepth
  const legHeight = height - slab
  return [
    {
      name: `${name}-top`,
      center: [0, height - slab / 2, 0],
      size: [width, slab, length],
    },
    ...legs.flatMap(z => [-1, 1].map((side): ColliderBox => ({
      name: `${name}-leg`,
      center: [side * legX, legHeight / 2, z],
      size: [leg, legHeight, leg],
    }))),
  ]
}
