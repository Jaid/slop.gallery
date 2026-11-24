import type {Portrait} from './types.ts'
import type {Object3D} from 'three/webgpu'

import {hasPlacard} from './portraitFlavor.ts'

/** where a work’s placard takes up room on its wall: below its frame, above it for a low hang, or nowhere for a work that never gets one */
export type PlacardSide = 'above' | 'below' | 'none'

// Shared by the hung label, its placement preview and wall clearance checks.
const portraitLabel = {
  height: 0.31,
  depth: 0.045,
  offset: 0.37,
  clearance: 0.055,
  neighborClearance: 0.125,
}

/** The placard of a frame, centered below it or, for a low hang, above it. */
export function portraitLabelLayout(width: number, height: number, above = false) {
  const y = above ? height / 2 + portraitLabel.offset : -height / 2 - portraitLabel.offset
  return {
    width: Math.min(width, 1.65),
    titleWidth: Math.min(width, 1.55),
    creatorWidth: Math.min(width, 1.5),
    y,
    bottom: y - portraitLabel.height / 2,
    top: y + portraitLabel.height / 2,
  }
}

/** Where the placard of a work takes up room on its wall: on its side as long as it has one or `placardsPossible` says it may still get one, and nowhere once neither holds, like for a work nobody told anything about on a page with `?ai=false`. */
export function placardSide(work: Pick<Portrait, 'creator' | 'labelAbove' | 'pending' | 'title'>, placardsPossible: boolean): PlacardSide {
  if (!placardsPossible && !hasPlacard(work)) {
    return 'none'
  }
  return work.labelAbove ? 'above' : 'below'
}

// Text and backing meshes share the label marker; the frame itself does not.
export function isPortraitLabelHit(object: Object3D, portrait: Object3D) {
  for (let current: Object3D | null = object; current && current !== portrait; current = current.parent) {
    if (current.userData.portraitLabel === true) {
      return true
    }
  }
  return false
}

export default portraitLabel
