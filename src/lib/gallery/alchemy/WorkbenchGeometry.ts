import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Path, Shape} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'
import {alchemySink, workbench} from './alchemyMachine.ts'

/** how far the top’s edges are eased */
const ease = 0.003
/** how far the foot plates reach out past the legs, and how thick they are */
const foot = [0.025, 0.012] as const

/** a box a collider takes up, in the bench’s frame: where its middle lies and how large it is */
export type WorkbenchCollider = {
  center: readonly [number, number, number]
  size: readonly [number, number, number]
}

/**
 * The workbench of the alchemy machine, see {@link workbench}: a thick slab of brass with eased edges and the round hole of the sink cut through its east end, over a frame of blackened iron – bars under its sides and ends, a stretcher each way and four square legs on foot plates, set in from its edge so they stand clear of the wall’s baseboard.
 * Its frame lines up with the world’s, its origin on the floor under the top’s middle; the `top` is a piece of its own, which its collider follows round the hole.
 */
export default class WorkbenchGeometry {
  readonly colliders: ReadonlyArray<WorkbenchCollider>
  readonly frame: BufferGeometry
  readonly top: BufferGeometry

  constructor() {
    const {apron: [apronDepth, apronThickness], depth, height, inset, leg, length, overhang, top} = workbench
    const [sinkX, , sinkZ] = alchemySink.center
    const [benchX, benchZ] = workbench.center
    // In the shape’s plane, x runs east and y north, so it turns flat onto the bench by its rotation about x.
    const outline = new Shape
    outline.moveTo(-length / 2, -depth / 2)
    outline.lineTo(length / 2, -depth / 2)
    outline.lineTo(length / 2, depth / 2)
    outline.lineTo(-length / 2, depth / 2)
    outline.closePath()
    const hole = new Path
    hole.absarc(sinkX - benchX, -(sinkZ - benchZ), alchemySink.radius + alchemySink.thickness, 0, Math.PI * 2, true)
    outline.holes.push(hole)
    const slab = new ExtrudeGeometry(outline, {
      depth: top - ease * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: ease,
      bevelThickness: ease,
      bevelOffset: -ease,
      curveSegments: 72,
    })
    slab.rotateX(-Math.PI / 2).translate(0, height - top + ease, 0)
    this.top = slab
    const underTop = height - top
    const apronY = underTop - apronDepth / 2
    const frameLength = length - overhang * 2
    const frameDepth = depth - overhang * 2
    const parts: Array<BufferGeometry> = []
    // The bars under both long sides and across both ends, their faces where the top’s overhang ends
    for (const side of [-1, 1]) {
      parts.push(
        place(roundedBox([frameLength, apronDepth, apronThickness], 0.004, 1), 0, apronY, side * (depth / 2 - overhang - apronThickness / 2)),
        place(roundedBox([apronThickness, apronDepth, frameDepth - apronThickness * 2], 0.004, 1), side * (length / 2 - overhang - apronThickness / 2), apronY, 0),
      )
    }
    const legX = length / 2 - inset
    const legZ = depth / 2 - inset
    const legs = [-1, 1].flatMap(x => [-1, 1].map(z => [x * legX, z * legZ] as const))
    const stretcherY = 0.16
    // A stretcher each way between the legs, low down, tying them
    parts.push(
      place(roundedBox([legX * 2 - leg, 0.028, 0.028], 0.004, 1), 0, stretcherY, -legZ),
      place(roundedBox([legX * 2 - leg, 0.028, 0.028], 0.004, 1), 0, stretcherY, legZ),
      place(roundedBox([0.028, 0.028, legZ * 2 - leg], 0.004, 1), -legX, stretcherY, 0),
      place(roundedBox([0.028, 0.028, legZ * 2 - leg], 0.004, 1), legX, stretcherY, 0),
    )
    const [footOut, footTall] = foot
    for (const [x, z] of legs) {
      parts.push(
        place(roundedBox([leg, underTop, leg], 0.004, 1), x, underTop / 2, z),
        place(roundedBox([leg + footOut * 2, footTall, leg + footOut * 2], 0.003, 1), x, footTall / 2, z),
      )
    }
    this.frame = mergeParts(parts)
    this.colliders = legs.map(([x, z]) => ({
      center: [x, underTop / 2, z] as const,
      size: [leg, underTop, leg] as const,
    }))
  }

  dispose() {
    this.frame.dispose()
    this.top.dispose()
  }
}
