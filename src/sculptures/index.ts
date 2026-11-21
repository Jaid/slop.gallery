import type Sculpture from './base/Sculpture.ts'

import AntiphonSculpture from './antiphon/AntiphonSculpture.ts'
import BlockSculpture from './block/BlockSculpture.ts'
import SahurSculpture from './sahur/SahurSculpture.ts'

/** The first entry is the default seed’s sculpture. Append new entries rather than reordering existing ones. */
export const sculptures = {
  block: BlockSculpture,
  antiphon: AntiphonSculpture,
  sahur: SahurSculpture,
} as const

export type SculptureId = keyof typeof sculptures

export function createSculpture(id: SculptureId): Sculpture {
  const SculptureClass = sculptures[id]
  return new SculptureClass
}

export type {default as Sculpture, SculptureModel, SculptureModelProps} from './base/Sculpture.ts'
