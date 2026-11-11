import type {ColliderBox} from './plankTable.ts'

import {baseboardCapFront} from './architectureDimensions.ts'

/**
 * A workshop table of blackened iron under a slab of honed stone, built to stand against a wall: square legs on foot plates, tied together under the slab by a band of flat bar round its sides and ends and a cross band at every pair of legs between the ends, and low down by square stretchers along both sides and across every pair.
 * In its own frame it runs along x, its back toward +z, its origin on the floor under the slab’s middle; its `height` is the slab’s upper face over the floor, all in meters.
 */
export type IronTable = {
  /** how deep the band of flat bar under the slab reaches down, and how thick it is */
  apron: readonly [depth: number, thickness: number]
  /** how far the slab reaches back past the frame, toward the wall, out over the baseboard */
  back: number
  /** how deep the slab is, from its front to its back */
  depth: number
  /** where the outer faces of the frame’s front and back lie, along z */
  frameZ: readonly [front: number, back: number]
  height: number
  /** the side of its square legs */
  leg: number
  /** where along it from its middle its pairs of legs stand */
  legs: ReadonlyArray<number>
  /** where the middles of its front and back legs lie, along z */
  legZ: readonly [front: number, back: number]
  /** how long the slab is, end to end */
  length: number
  /** how far the slab overhangs the frame at its front and ends */
  overhang: number
  /** how high the middles of the stretchers lie over the floor, and the side of their square section */
  stretcher: readonly [y: number, side: number]
  /** how thick the slab is */
  top: number
}

/** how far a table’s legs stand back from the faces of its band, so their faces never fight */
const legInset = 0.003
/** how far the legs of a table against a wall stand clear of the wall’s baseboard */
export const baseboardClearance = 0.02
/** how thick the iron plates under the legs’ feet are */
export const footPlate = 0.01

/** A table of the size with `pairs` pairs of legs, one at either end and evenly between them so a long slab never sags. */
export function ironTable({pairs, ...table}: Omit<IronTable, 'frameZ' | 'legs' | 'legZ'> & {pairs: number}): IronTable {
  const {back, depth, leg, length, overhang} = table
  if (pairs < 2) {
    throw new RangeError('An iron table needs a pair of legs at either end.')
  }
  const frameZ = [-depth / 2 + overhang, depth / 2 - back] as const
  const reach = length / 2 - overhang - legInset - leg / 2
  return {
    ...table,
    frameZ,
    legZ: [frameZ[0] + legInset + leg / 2, frameZ[1] - legInset - leg / 2],
    legs: Array.from({length: pairs}, (_, index) => (index * 2 / (pairs - 1) - 1) * reach),
  }
}

/** How far out of the center line of the wall it stands against the table’s middle lies: as close as leaves its legs, and everything else that reaches the floor, clear of the default baseboard’s cap, with its slab reaching back out over the baseboard. */
export function ironTableStandOff({depth, back}: IronTable) {
  return baseboardCapFront + baseboardClearance + depth / 2 - back
}

/**
 * The table’s colliders, named after it, in its frame: its legs and stretchers, and either its slab with the band under it, solid down to the band’s bottom, or, with `top: false` for a slab with holes that has a collider of its own, only the band.
 */
export function ironTableColliders({apron: [apronDepth, apronThickness], depth, frameZ, height, leg, legs, legZ, length, overhang, stretcher: [stretcherY, stretcherSide], top}: IronTable, name: string, {top: solidTop = true}: {top?: boolean} = {}): Array<ColliderBox> {
  const underTop = height - top
  const apronY = underTop - apronDepth / 2
  const frameLength = length - overhang * 2
  const frameDepth = frameZ[1] - frameZ[0]
  const frameMiddle = (frameZ[0] + frameZ[1]) / 2
  const legHeight = underTop - footPlate
  const reach = legs.at(-1)! - legs[0]
  const boxes: Array<ColliderBox> = []
  if (solidTop) {
    boxes.push({
      name: `${name}-top`,
      center: [0, height - (top + apronDepth) / 2, 0],
      size: [length, top + apronDepth, depth],
    })
  } else {
    boxes.push(...frameZ.map((z, index): ColliderBox => ({
      name: `${name}-apron`,
      center: [0, apronY, z + (index ? -1 : 1) * apronThickness / 2],
      size: [frameLength, apronDepth, apronThickness],
    })), ...[-1, 1].map((side): ColliderBox => ({
      name: `${name}-apron`,
      center: [side * (frameLength / 2 - apronThickness / 2), apronY, frameMiddle],
      size: [apronThickness, apronDepth, frameDepth],
    })))
  }
  boxes.push(
    ...legs.flatMap(x => legZ.map((z): ColliderBox => ({
      name: `${name}-leg`,
      center: [x, footPlate + legHeight / 2, z],
      size: [leg, legHeight, leg],
    }))),
    ...legZ.map((z): ColliderBox => ({
      name: `${name}-stretcher`,
      center: [(legs[0] + legs.at(-1)!) / 2, stretcherY, z],
      size: [reach, stretcherSide, stretcherSide],
    })),
    ...legs.map((x): ColliderBox => ({
      name: `${name}-stretcher`,
      center: [x, stretcherY, (legZ[0] + legZ[1]) / 2],
      size: [stretcherSide, stretcherSide, legZ[1] - legZ[0]],
    })),
  )
  return boxes
}

/** the blackened iron of every iron table’s frame, see `WroughtIronMaterial`: more scale than bare metal and a shade lighter than the alchemy machine’s chest, so its thin bars take the room’s light and keep their shape instead of reading as flat black */
export const ironTableFinish = {
  tone: '#4a4743',
  bloomColor: '#5e3d29',
  metalness: 0.35,
} as const
