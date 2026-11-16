import type {WallOpening} from '../placement/wallGeometry.ts'

import {Vector2} from 'three/webgpu'

import {openingArc} from '../placement/wallGeometry.ts'

/** The outline of an opening in the wall’s plane: along its bottom, then over its head from the right jamb to the left one, which closes it down to the bottom again. Openings of the same profile have outlines of as many points. */
export default function openingOutline(hole: WallOpening) {
  if (hole.profile === 'round') {
    throw new RangeError('A round opening has no jambs to outline down to its bottom.')
  }
  const divisions = hole.profile === 'arch' ? 20 : 12
  const bottom = hole.bottom ?? 0
  const half = hole.width / 2
  const {radius, center} = openingArc(hole)
  const spring = Math.atan2(Math.sqrt(Math.max(0, radius ** 2 - half ** 2)), half)
  const head = Array.from({length: divisions + 1}, (_, i) => {
    if (hole.profile !== 'arch') {
      return new Vector2(hole.u + half - hole.width * i / divisions, hole.height)
    }
    const angle = spring + (Math.PI - spring * 2) * i / divisions
    return new Vector2(hole.u + Math.cos(angle) * radius, center + Math.sin(angle) * radius)
  })
  return [new Vector2(hole.u - half, bottom), new Vector2(hole.u + half, bottom), ...head]
}
