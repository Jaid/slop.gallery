import type {BufferGeometry} from 'three/webgpu'

import {ExtrudeGeometry, Shape} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {forgeTable} from '../forge.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'

/** how far the top’s edges are eased */
const ease = 0.003
/** how far the foot plates reach out past the legs, and how thick they are */
const foot = [0.02, 0.01] as const

/** a box a collider takes up, in the table’s frame on the floor under its middle */
export type PainterTableCollider = {
  center: readonly [number, number, number]
  name: string
  size: readonly [number, number, number]
}

/**
 * The Forge’s painter’s table, see {@link forgeTable}: a slab of hammered brass with eased edges on a frame of blackened iron – bars under its sides and ends, a stretcher each way and four square legs on foot plates, set in from its edge so the ones against the wall stand clear of the baseboard.
 * It runs along z, its origin on the floor under its middle. Its `top` is a piece of its own and its `frame` the iron under it.
 */
export default class PainterTableGeometry {
  readonly colliders: ReadonlyArray<PainterTableCollider>
  readonly frame: BufferGeometry
  readonly top: BufferGeometry

  constructor() {
    const {apron: [apronDepth, apronThickness], height, inset, leg, length, top, width} = forgeTable
    const outline = new Shape
    outline.moveTo(-width / 2, -length / 2)
    outline.lineTo(width / 2, -length / 2)
    outline.lineTo(width / 2, length / 2)
    outline.lineTo(-width / 2, length / 2)
    outline.closePath()
    const slab = new ExtrudeGeometry(outline, {
      depth: top - ease * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: ease,
      bevelThickness: ease,
      bevelOffset: -ease,
      curveSegments: 2,
    })
    slab.rotateX(-Math.PI / 2).translate(0, height - top + ease, 0)
    this.top = slab
    const underTop = height - top
    const apronY = underTop - apronDepth / 2
    const parts: Array<BufferGeometry> = []
    // The bars sit just inside the top’s edge, over the legs.
    const barX = width / 2 - inset
    const barZ = length / 2 - inset
    for (const side of [-1, 1]) {
      parts.push(
        place(roundedBox([apronThickness, apronDepth, barZ * 2 + apronThickness], 0.003, 1), side * barX, apronY, 0),
        place(roundedBox([barX * 2 - apronThickness, apronDepth, apronThickness], 0.003, 1), 0, apronY, side * barZ),
      )
    }
    const legs = [-1, 1].flatMap(x => [-1, 1].map(z => [x * barX, z * barZ] as const))
    const stretcherY = 0.14
    parts.push(
      place(roundedBox([barX * 2 - leg, 0.024, 0.024], 0.003, 1), 0, stretcherY, -barZ),
      place(roundedBox([barX * 2 - leg, 0.024, 0.024], 0.003, 1), 0, stretcherY, barZ),
      place(roundedBox([0.024, 0.024, barZ * 2 - leg], 0.003, 1), -barX, stretcherY, 0),
      place(roundedBox([0.024, 0.024, barZ * 2 - leg], 0.003, 1), barX, stretcherY, 0),
    )
    const [footOut, footTall] = foot
    for (const [x, z] of legs) {
      parts.push(
        place(roundedBox([leg, underTop, leg], 0.003, 1), x, underTop / 2, z),
        place(roundedBox([leg + footOut * 2, footTall, leg + footOut * 2], 0.002, 1), x, footTall / 2, z),
      )
    }
    this.frame = mergeParts(parts)
    const covered = top + apronDepth
    this.colliders = [
      {
        name: 'forge-table-top',
        center: [0, height - covered / 2, 0],
        size: [width, covered, length],
      },
      ...legs.map(([x, z]): PainterTableCollider => ({
        name: 'forge-table-leg',
        center: [x, underTop / 2, z],
        size: [leg, underTop, leg],
      })),
    ]
  }

  dispose() {
    this.frame.dispose()
    this.top.dispose()
  }
}
