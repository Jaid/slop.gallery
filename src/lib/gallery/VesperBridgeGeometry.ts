import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, CatmullRomCurve3, TubeGeometry, Vector3} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {vesperLanternHalf, vesperLanternSillY} from './vesperCeiling.ts'

const translated = (geometry: BufferGeometry, x: number, y: number, z = 0) => geometry.translate(x, y, z)

type Size = readonly [width: number, depth: number]

/** A two-meter-wide gallery crossing the lantern east–west, wide enough to read as a bridge while leaving two equally long glazed halves. */
export const vesperBridge = {
  width: 2,
  deckThickness: 0.38,
  deckHeight: vesperLanternSillY + 0.06,
  crownRise: 0.92,
  endHeight: 0.3,
  rail: 0.055,
  balusterSpacing: 0.45,
} as const

/** A point on a bridge rail above the deck, at `x` across its span. */
export function vesperBridgeRailHeight(x: number, halfSpan: number) {
  const crown = 1 - (x / halfSpan) ** 2
  return vesperBridge.deckHeight + vesperBridge.endHeight + crown * vesperBridge.crownRise
}

/** The arched bronze rails and supports beneath the Vesper’s transverse gallery bridge. */
export default class VesperBridgeGeometry {
  readonly bronze: BufferGeometry
  readonly stone: BufferGeometry

  constructor(size: Size) {
    const [halfX] = vesperLanternHalf(size)
    const span = halfX
    const {deckHeight, deckThickness, rail, width, balusterSpacing} = vesperBridge
    const stone: Array<BufferGeometry> = []
    const bronze: Array<BufferGeometry> = []
    stone.push(translated(new BoxGeometry(span * 2, deckThickness, width), 0, deckHeight))
    for (const z of [-1, 1]) {
      const edge = z * width / 2
      const points = [-1, -0.75, -0.5, 0, 0.5, 0.75, 1].map(fraction => new Vector3(fraction * span, vesperBridgeRailHeight(fraction * span, span), edge))
      bronze.push(new TubeGeometry(new CatmullRomCurve3(points), 40, rail, 8, false))
      bronze.push(new TubeGeometry(new CatmullRomCurve3([
        new Vector3(-span, deckHeight + 0.14, edge),
        new Vector3(span, deckHeight + 0.14, edge),
      ]), 1, rail * 0.8, 8, false))
      for (let x = -span + balusterSpacing; x < span - balusterSpacing / 2; x += balusterSpacing) {
        bronze.push(new TubeGeometry(new CatmullRomCurve3([
          new Vector3(x, deckHeight + deckThickness / 2, edge),
          new Vector3(x, vesperBridgeRailHeight(x, span), edge),
        ]), 1, rail * 0.65, 6, false))
      }
      for (const end of [-1, 1]) {
        const x = end * (span - 0.2)
        stone.push(translated(new BoxGeometry(0.4, 0.64, width + 0.24), x, deckHeight - 0.08))
        bronze.push(new TubeGeometry(new CatmullRomCurve3([
          new Vector3(x, deckHeight + deckThickness / 2, edge),
          new Vector3(x * 0.93, deckHeight + 0.35, edge),
        ]), 1, rail * 1.5, 8, false))
      }
    }
    // Two broad cross-ties and a central keystone articulate the walkway itself.
    for (const x of [-span * 0.72, span * 0.72]) {
      bronze.push(translated(new BoxGeometry(0.07, deckThickness + 0.08, width + 0.06), x, deckHeight))
    }
    bronze.push(translated(new BoxGeometry(0.12, deckThickness + 0.14, width + 0.08), 0, deckHeight))
    this.stone = mergeParts(stone)
    this.bronze = mergeParts(bronze)
    this.stone.computeBoundingBox()
    this.stone.computeBoundingSphere()
  }

  dispose() {
    this.stone.dispose()
    this.bronze.dispose()
  }
}
