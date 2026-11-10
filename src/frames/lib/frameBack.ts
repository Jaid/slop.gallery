import type {BufferGeometry} from 'three/webgpu'

import {frameShapeAttribute} from './frameGeometry.ts'

/**
 * Hands the parts of a frame’s back, its board and the back runs of its members, which `sweepProfile` puts in the group of the material its profile ends in, the opening’s half width and half height, which `backSurface` reads, so a back material can lay out stretcher bars, labels and the hanging wire by the work’s size. A profile ending in a material of its own for the back keeps those values from every other part.
 */
export function withOpening(parts: Map<number, BufferGeometry>, back: number, halfWidth: number, halfHeight: number) {
  const part = parts.get(back)
  if (!part) {
    throw new Error(`The profile has no back in the material ${back}.`)
  }
  const shape = part.getAttribute(frameShapeAttribute)
  for (let index = 0; index < shape.count; index++) {
    shape.setZ(index, halfHeight)
    shape.setW(index, halfWidth)
  }
  return parts
}
