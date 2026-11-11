import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Path, Shape} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'
import {steelStretcher} from '../steelTable.ts'
import {alchemySink, workbench} from './alchemyMachine.ts'

/** how far the top’s edges are eased */
const ease = 0.004

/** a box a collider takes up, in the bench’s frame: where its middle lies and how large it is */
export type WorkbenchCollider = {
  center: readonly [number, number, number]
  size: readonly [number, number, number]
}

/**
 * The workbench of the alchemy machine, see {@link workbench}: a top of one thick steel slab with eased edges and the round hole of the sink cut through its east end, over iron rails round its sides and ends, on square steel legs set in from the top’s edges and tied together by a stretcher along each side.
 * Its frame lines up with the world’s, its origin on the floor under the top’s middle; the `top` is a piece of its own, which its collider follows round the hole.
 */
export default class WorkbenchGeometry {
  readonly colliders: ReadonlyArray<WorkbenchCollider>
  readonly frame: BufferGeometry
  readonly top: BufferGeometry

  constructor() {
    const {apron: [apronDepth, apronThickness], depth, height, leg, legInset, length, overhang} = workbench
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
      depth: workbench.top - ease * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: ease,
      bevelThickness: ease,
      bevelOffset: -ease,
      curveSegments: 72,
    })
    this.top = slab.rotateX(-Math.PI / 2).translate(0, height - workbench.top + ease, 0)
    const underTop = height - workbench.top
    const apronY = underTop - apronDepth / 2
    const parts: Array<BufferGeometry> = []
    // The rails along both sides and across both ends, their faces where the top’s overhang ends
    for (const side of [-1, 1]) {
      parts.push(
        place(roundedBox([length - overhang * 2, apronDepth, apronThickness], 0.004, 2), 0, apronY, side * (depth / 2 - overhang - apronThickness / 2)),
        place(roundedBox([apronThickness, apronDepth, depth - overhang * 2 - apronThickness * 2], 0.004, 2), side * (length / 2 - overhang - apronThickness / 2), apronY, 0),
      )
    }
    const legX = length / 2 - legInset - leg / 2
    const legZ = depth / 2 - legInset - leg / 2
    const legs = [-1, 1].flatMap(x => [-1, 1].map(z => [x * legX, z * legZ] as const))
    for (const [x, z] of legs) {
      parts.push(place(roundedBox([leg, underTop, leg], 0.004, 2), x, underTop / 2, z))
    }
    // A stretcher along each side, between the legs at its ends
    for (const side of [-1, 1]) {
      parts.push(place(roundedBox([legX * 2 + leg, steelStretcher.height, steelStretcher.thickness], 0.004, 2), 0, steelStretcher.y, side * legZ))
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
