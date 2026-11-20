import type {FootprintInput} from './base/Box.ts'
import type {BeamBoxInput} from './BeamBox.ts'
import type {ClosedBoxInput} from './ClosedBox.ts'
import type {SkyBoxInput} from './SkyBox.ts'
import type {VoidBoxInput} from './VoidBox.ts'

import zod from 'zod'

import Box from './base/Box.ts'
import BeamBox, {beamBoxInputSchema} from './BeamBox.ts'
import ClosedBox, {closedBoxInputSchema} from './ClosedBox.ts'
import SkyBox, {skyBoxInputSchema} from './SkyBox.ts'
import VoidBox, {voidBoxInputSchema} from './VoidBox.ts'

/** the plain data of any box, told apart by its keys */
export const boxInputSchema = zod.union([beamBoxInputSchema, skyBoxInputSchema, voidBoxInputSchema, closedBoxInputSchema])
export type BoxInput = BeamBoxInput | ClosedBoxInput | SkyBoxInput | VoidBoxInput

/** The box as is, or the box described by the plain data: a sky box with a floor, a void box with a ceiling, a closed box with y and a beam box otherwise; the class’s schema rejects every key left over. */
export function createBox(input: Box | BoxInput): Box {
  if (input instanceof Box) {
    return input
  }
  if ('floor' in input) {
    return new SkyBox(input)
  }
  if ('ceiling' in input) {
    return new VoidBox(input)
  }
  if ('y' in input) {
    return new ClosedBox(input)
  }
  return new BeamBox(input)
}

/** The parts of the box that lie outside of the other one, as boxes that share no space with each other: the box itself where the two share none, and none where the other one covers it. */
export function subtractBox(box: Box, other: Box): Array<Box> {
  if (!box.overlaps(other)) {
    return [box]
  }
  const parts: Array<Box> = []
  const {top, bottom} = box
  let {x, x2, z, z2} = box
  // Slabs off its west and east, then off the north and south of what is left between them, then what is left under and over the other one.
  if (x < other.x) {
    parts.push(boxBetween({
      x,
      z,
      x2: other.x,
      z2,
    }, bottom, top))
    x = other.x
  }
  if (x2 > other.x2) {
    parts.push(boxBetween({
      x: other.x2,
      z,
      x2,
      z2,
    }, bottom, top))
    x2 = other.x2
  }
  if (z < other.z) {
    parts.push(boxBetween({
      x,
      z,
      x2,
      z2: other.z,
    }, bottom, top))
    z = other.z
  }
  if (z2 > other.z2) {
    parts.push(boxBetween({
      x,
      z: other.z2,
      x2,
      z2,
    }, bottom, top))
    z2 = other.z2
  }
  const footprint = {
    x,
    z,
    x2,
    z2,
  }
  if (bottom < other.bottom) {
    parts.push(boxBetween(footprint, bottom, other.bottom))
  }
  if (top > other.top) {
    parts.push(boxBetween(footprint, other.top, top))
  }
  return parts
}

/** The box over the footprint from `bottom` up to `top`, of the kind that reaches as far: endlessly down from -Infinity, endlessly up to Infinity. */
function boxBetween(footprint: FootprintInput, bottom: number, top: number) {
  if (Number.isFinite(bottom)) {
    return Number.isFinite(top) ? new ClosedBox({
      ...footprint,
      y: bottom,
      y2: top,
    }) : new SkyBox({
      ...footprint,
      floor: bottom,
    })
  }
  return Number.isFinite(top) ? new VoidBox({
    ...footprint,
    ceiling: top,
  }) : new BeamBox(footprint)
}

export {default as Box} from './base/Box.ts'
export type {FootprintInput} from './base/Box.ts'
export {default as BeamBox, beamBoxInputSchema} from './BeamBox.ts'
export type {BeamBoxInput} from './BeamBox.ts'
export {default as ClosedBox, closedBoxInputSchema} from './ClosedBox.ts'
export type {ClosedBoxInput} from './ClosedBox.ts'
export {default as SkyBox, skyBoxInputSchema} from './SkyBox.ts'
export type {SkyBoxInput} from './SkyBox.ts'
export {default as VoidBox, voidBoxInputSchema} from './VoidBox.ts'
export type {VoidBoxInput} from './VoidBox.ts'
