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
/** how far the stone surround stands back from the passage’s face, so it never shares that plane */
const surroundRecess = 0.001

/** A deep timber-lined side window from the Lodge to the Bastion’s blind branch, its Bastion end closed by stone. */
export default class LodgeEastWindowGeometry {
  readonly frame: BufferGeometry
  readonly glass: BoxGeometry
  readonly lining: BufferGeometry
  /** the castle-stone surround that takes the place of the timber on the passage’s face */
  readonly surround: BufferGeometry

  constructor() {
    const {x, z, width, bottom, top, glassThickness, border, sill} = lodgeEastWindow
    const height = top - bottom
    const middleY = (bottom + top) / 2
    const tunnelX = lodgeSpurX - lodgeSpurWidth / 2 + wallFace
    // The timber stops where the stone surround takes over, a millimeter inside the passage’s wall, so none of it shows on the Bastion side.
    const liningEnd = tunnelX - wallFace + surroundRecess
    const depth = liningEnd - x
    const middleX = (x + liningEnd) / 2
    // The reveal runs from the Lodge wall’s center line to just inside the passage’s wall, its sill, head and jambs reaching past the opening. The Lodge’s wall hides its near end, and the passage’s stone is cut round the rest.
    this.lining = mergeParts([
      box([depth, sill, width + border * 2], [middleX, bottom - sill / 2, z]),
      box([depth, border, width + border * 2], [middleX, top + border / 2, z]),
      ...[-1, 1].map(side => box([depth, height, border], [middleX, middleY, z + side * (width + border) / 2])),
    ])
    // On the Bastion side the passage is stone, so a surround of the same stone fills the wall’s thickness where the timber used to meet its face, stopping just short of both faces.
    const surroundDepth = wallFace - surroundRecess * 2
    const surroundX = tunnelX - surroundRecess - surroundDepth / 2
    this.surround = mergeParts([
      box([surroundDepth, sill, width + border * 2], [surroundX, bottom - sill / 2, z]),
      box([surroundDepth, border, width + border * 2], [surroundX, top + border / 2, z]),
      ...[-1, 1].map(side => box([surroundDepth, height, border], [surroundX, middleY, z + side * (width + border) / 2])),
    ])
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
    this.surround.dispose()
  }
}
