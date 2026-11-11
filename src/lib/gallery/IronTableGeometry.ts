import type {IronTable} from './ironTable.ts'
import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Path, Shape} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {footPlate} from './ironTable.ts'
import {place, roundedBox} from './lodgeInterior/place.ts'

/** how far the slab’s arrises are eased */
const ease = 0.004
/** how far the iron’s edges are rounded, as hot-rolled bar’s are */
const ironRadius = 0.003
/** A bar of iron of the size, its middle at the point. */
const bar = (size: [number, number, number], x: number, y: number, z: number) => place(roundedBox(size, ironRadius, 2), x, y, z)

/** a round hole through the slab, its middle in the table’s frame */
export type IronTableHole = {
  center: readonly [x: number, z: number]
  radius: number
}

/**
 * An iron table, see {@link IronTable}: its slab of stone with eased arrises and any round holes cut through it, and its frame of blackened iron, the band of flat bar under the slab, the square legs on their foot plates and the stretchers low down between them.
 * Its frame lines up with the table’s, its origin on the floor under the slab’s middle.
 */
export default class IronTableGeometry {
  readonly frame: BufferGeometry
  readonly top: BufferGeometry

  constructor(table: IronTable, holes: ReadonlyArray<IronTableHole> = []) {
    const {apron: [apronDepth, apronThickness], depth, frameZ, height, leg, legs, legZ, length, overhang, stretcher: [stretcherY, stretcherSide], top} = table
    // In the shape’s plane, x runs along the table and y toward its front, so it turns flat onto the table by its rotation about x.
    const outline = new Shape
    outline.moveTo(-length / 2, -depth / 2)
    outline.lineTo(length / 2, -depth / 2)
    outline.lineTo(length / 2, depth / 2)
    outline.lineTo(-length / 2, depth / 2)
    outline.closePath()
    for (const {center: [x, z], radius} of holes) {
      const hole = new Path
      hole.absarc(x, -z, radius, 0, Math.PI * 2, true)
      outline.holes.push(hole)
    }
    const slab = new ExtrudeGeometry(outline, {
      depth: top - ease * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: ease,
      bevelThickness: ease,
      bevelOffset: -ease,
      curveSegments: 72,
    })
    this.top = slab.rotateX(-Math.PI / 2).translate(0, height - top + ease, 0)
    const underTop = height - top
    const apronY = underTop - apronDepth / 2
    const frameLength = length - overhang * 2
    const frameDepth = frameZ[1] - frameZ[0]
    const frameMiddle = (frameZ[0] + frameZ[1]) / 2
    // The band along the front and the back, the full length of the frame, and across the ends between them
    const parts: Array<BufferGeometry> = Array.from(frameZ, (z, index) => bar([frameLength, apronDepth, apronThickness], 0, apronY, z + (index ? -1 : 1) * apronThickness / 2))
    for (const side of [-1, 1]) {
      parts.push(bar([apronThickness, apronDepth, frameDepth - apronThickness * 2], side * (frameLength / 2 - apronThickness / 2), apronY, frameMiddle))
    }
    // A cross band at every pair of legs between the ends, carrying the slab in the middle
    for (const x of legs.slice(1, -1)) {
      parts.push(bar([apronThickness, apronDepth, frameDepth - apronThickness * 2], x, apronY, frameMiddle))
    }
    const legHeight = underTop - footPlate
    for (const x of legs) {
      for (const z of legZ) {
        parts.push(
          bar([leg, legHeight, leg], x, footPlate + legHeight / 2, z),
          bar([leg + 0.03, footPlate, leg + 0.03], x, footPlate / 2, z),
        )
      }
      // The stretcher across the pair, between the legs’ inner faces
      parts.push(bar([stretcherSide, stretcherSide, legZ[1] - legZ[0] - leg], x, stretcherY, (legZ[0] + legZ[1]) / 2))
    }
    // The stretchers along the front and the back, between the end legs’ inner faces
    const reach = legs.at(-1)! - legs[0]
    for (const z of legZ) {
      parts.push(bar([reach - leg, stretcherSide, stretcherSide], (legs[0] + legs.at(-1)!) / 2, stretcherY, z))
    }
    this.frame = mergeParts(parts)
  }

  dispose() {
    this.frame.dispose()
    this.top.dispose()
  }
}
