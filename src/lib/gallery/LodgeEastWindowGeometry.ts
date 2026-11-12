import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {wallFace} from './architectureDimensions.ts'
import {lodgeSpurWidth, lodgeSpurX} from './bastion.ts'
import {lodgeEastWindow} from './lodge.ts'

const box = (size: readonly [number, number, number], position: readonly [number, number, number]) => {
  const geometry = new BoxGeometry(...size)
  geometry.translate(...position)
  return geometry
}

/** the lining’s material groups: 0 the timber of the tunnel, 1 the stone of its Bastion-facing ends, which the mesh drawing it supplies in that order */
export const lodgeEastWindowMaterials = {
  timber: 0,
  stone: 1,
} as const

/** A deep timber-lined side window from the Lodge to the Bastion’s blind branch, its ends on the Bastion’s side faced in that side’s stone. */
export default class LodgeEastWindowGeometry {
  readonly frame: BufferGeometry
  readonly glass: BoxGeometry
  readonly lining: BufferGeometry

  constructor() {
    const {x, z, width, bottom, top, glassThickness, border, sill} = lodgeEastWindow
    const height = top - bottom
    const middleY = (bottom + top) / 2
    const tunnelX = lodgeSpurX - lodgeSpurWidth / 2 + wallFace
    const depth = tunnelX - x
    const middleX = (x + tunnelX) / 2
    // The reveal runs from the Lodge wall’s center line on to the passage’s face, its sill, head and jambs reaching past the opening: the Lodge’s wall hides them, and the passage’s stone is cut round them, so they frame the window flush there instead of sharing the planes of the stone’s own cut faces.
    this.lining = mergeParts([
      box([depth, sill, width + border * 2], [middleX, bottom - sill / 2, z]),
      box([depth, border, width + border * 2], [middleX, top + border / 2, z]),
      ...[-1, 1].map(side => box([depth, height, border], [middleX, middleY, z + side * (width + border) / 2])),
    ])
    // Each part’s end on the Bastion’s stone wall is its +x face, so triangles facing that way alone take the stone’s material group, in runs along the index: no wood shows around the frame there, while the tunnel behind the glass stays timber, as the Lodge’s side of the window. Flush with the wall, the stone ends share its plane and its world-mapped pattern runs on across them.
    const index = this.lining.index!
    const normals = this.lining.getAttribute('normal')
    let groupStart = 0
    let groupMaterial: number | undefined
    for (let triangle = 0; triangle <= index.count / 3; triangle++) {
      const material = triangle === index.count / 3 ? undefined : (normals.getX(index.getX(triangle * 3)) === 1 ? lodgeEastWindowMaterials.stone : lodgeEastWindowMaterials.timber)
      if (material === groupMaterial) {
        continue
      }
      if (groupMaterial !== undefined) {
        this.lining.addGroup(groupStart, triangle * 3 - groupStart, groupMaterial)
      }
      groupStart = triangle * 3
      groupMaterial = material
    }
    this.glass = box([glassThickness, height, width], [tunnelX - glassThickness / 2, middleY, z])
    const stop = 0.035
    const stopX = tunnelX + 0.0125
    this.frame = mergeParts([
      ...[bottom + stop / 2, top - stop / 2].map(y => box([0.025, stop, width], [stopX, y, z])),
      ...[-1, 1].map(side => box([0.025, height - stop * 2, stop], [stopX, middleY, z + side * (width - stop) / 2])),
    ])
  }

  dispose() {
    this.frame.dispose()
    this.glass.dispose()
    this.lining.dispose()
  }
}
