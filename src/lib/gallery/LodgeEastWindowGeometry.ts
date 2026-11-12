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

/** A deep timber-lined side window from the Lodge to the Bastion’s blind branch. */
export default class LodgeEastWindowGeometry {
  readonly frame: BufferGeometry
  readonly glass: BoxGeometry
  readonly lining: BufferGeometry

  constructor() {
    const {x, z, width, bottom, top, glassThickness, border, sill} = lodgeEastWindow
    const height = top - bottom
    const middleY = (bottom + top) / 2
    const tunnelX = lodgeSpurX - lodgeSpurWidth / 2 + wallFace
    const stoneBackX = tunnelX - wallFace
    const depth = stoneBackX - x
    const middleX = (x + stoneBackX) / 2
    // The timber lining runs from the Lodge wall’s center line on to the back of the Bastion passage’s stone wall, so no wood shows on the passage’s face.
    this.lining = mergeParts([
      box([depth, sill, width + border * 2], [middleX, bottom - sill / 2, z]),
      box([depth, border, width + border * 2], [middleX, top + border / 2, z]),
      ...[-1, 1].map(side => box([depth, height, border], [middleX, middleY, z + side * (width + border) / 2])),
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
  }
}
