import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Path, Shape} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'
import {alchemySink, workbench} from './alchemyMachine.ts'

/** A steel table, running along x, its origin on the floor under its middle. */
export type WorkbenchLayout = {
  apron: readonly [depth: number, thickness: number]
  depth: number
  height: number
  leg: number
  length: number
  overhang: number
  top: number
}
/** A box in the table’s frame. */
export type WorkbenchCollider = {
  center: readonly [number, number, number]
  size: readonly [number, number, number]
}

/** A rounded metal member centered at the given point. */
const piece = (size: [number, number, number], [x, y, z]: readonly [number, number, number]) => place(roundedBox(size, 0.004, 2), x, y, z)

/** A steel slab on a dark metal frame. The optional opening passes right through the slab for the alchemy sink. */
export default class WorkbenchGeometry {
  readonly colliders: ReadonlyArray<WorkbenchCollider>
  readonly frame: BufferGeometry
  readonly top: BufferGeometry

  constructor(layout: WorkbenchLayout = workbench, opening: {
    radius: number
    x: number
    z: number
  } | null = {
    x: alchemySink.center[0] - workbench.center[0],
    z: alchemySink.center[2] - workbench.center[1],
    radius: alchemySink.radius + alchemySink.thickness,
  }) {
    const {apron: [apronDepth, apronThickness], depth, height, leg, length, overhang} = layout
    const ease = 0.004
    const outline = new Shape
    outline.moveTo(-length / 2, -depth / 2)
    outline.lineTo(length / 2, -depth / 2)
    outline.lineTo(length / 2, depth / 2)
    outline.lineTo(-length / 2, depth / 2)
    outline.closePath()
    if (opening) {
      const hole = new Path
      hole.absarc(opening.x, -opening.z, opening.radius, 0, Math.PI * 2, true)
      outline.holes.push(hole)
    }
    const slab = new ExtrudeGeometry(outline, {
      depth: layout.top - ease * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: ease,
      bevelThickness: ease,
      bevelOffset: -ease,
      curveSegments: 72,
    })
    this.top = slab.rotateX(-Math.PI / 2).translate(0, height - layout.top + ease, 0)
    const underTop = height - layout.top
    const apronY = underTop - apronDepth / 2
    const parts: Array<BufferGeometry> = []
    for (const side of [-1, 1]) {
      parts.push(
        piece([length - overhang * 2, apronDepth, apronThickness], [0, apronY, side * (depth / 2 - overhang - apronThickness / 2)]),
        piece([apronThickness, apronDepth, depth - overhang * 2 - apronThickness * 2], [side * (length / 2 - overhang - apronThickness / 2), apronY, 0]),
        // Low stretchers along the sides leave the center free for the machine and its pipe.
        piece([length - overhang * 2 - leg * 2, 0.045, 0.045], [0, 0.2, side * (depth / 2 - overhang - leg / 2)]),
      )
    }
    const legs = [-1, 1].flatMap(x => [-1, 1].map(z => [x * (length / 2 - overhang - leg / 2), z * (depth / 2 - overhang - leg / 2)] as const))
    for (const [x, z] of legs) {
      parts.push(piece([leg, underTop, leg], [x, underTop / 2, z]))
    }
    this.frame = mergeParts(parts)
    this.colliders = [
      ...legs.map(([x, z]) => ({
        center: [x, underTop / 2, z] as const,
        size: [leg, underTop, leg] as const,
      })),
      ...[-1, 1].map(side => ({
        center: [0, 0.2, side * (depth / 2 - overhang - leg / 2)] as const,
        size: [length - overhang * 2 - leg * 2, 0.045, 0.045] as const,
      })),
    ]
  }

  dispose() {
    this.frame.dispose()
    this.top.dispose()
  }
}
