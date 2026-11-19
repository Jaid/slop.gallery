import type {BufferGeometry} from 'three/webgpu'

import {BoxGeometry, CylinderGeometry} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {place, roundedBox} from './place.ts'

/**
 * A leather club seat with rolled arms, loose seat and back cushions on a timber plinth – one seat for an armchair, several for a sofa.
 *
 * The origin is on the floor under the middle of the seat and the seat faces +z. Geometry is merged per material: `leather` for the upholstery, `timber` for the plinth and feet.
 */
export default class UpholsteredSeatGeometry {
  /** how high the arms’ sides reach, where the middles of their rolls lie */
  static readonly armHeight = 0.6
  /** how far the rolls on the arms lie out from the middles of the arms */
  static readonly armRollOffset = 0.015
  static readonly armWidth = 0.22
  /** the radius of the rolls on the arms, swelling a little past the arms’ faces */
  static readonly armRollRadius = this.armWidth * 0.6
  static readonly backHeight = 0.9
  /** how high the seat cushions lie on the deck under them */
  static readonly cushionHeight = 0.15
  static readonly depth = 0.95
  /** how high the top of the seat cushions lies, which whoever sits there sits on */
  static readonly seatHeight = 0.49
  readonly leather: BufferGeometry
  readonly timber: BufferGeometry
  readonly width: number

  constructor(seats: number, seatWidth = 0.68) {
    if (!Number.isInteger(seats) || seats < 1 || !(seatWidth > 0.3)) {
      throw new RangeError('A seat needs a whole number of seats and a seat width over 30 cm.')
    }
    const {armHeight: armTop, armRollOffset, armRollRadius, armWidth, backHeight, cushionHeight, depth, seatHeight} = UpholsteredSeatGeometry
    const width = seats * seatWidth + armWidth * 2
    this.width = width
    const back = 0.22
    const deckTop = seatHeight - cushionHeight
    const leather: Array<BufferGeometry> = []
    // Upholstered deck and back frame. Their rear faces step back 5 mm each behind the arms’ instead of sharing one plane, and
    // their ends, hidden in the arms, stay apart as well.
    leather.push(place(roundedBox([width - 0.02, deckTop - 0.2, depth - 0.02], 0.03), 0, (deckTop + 0.2) / 2, 0), place(roundedBox([width - 0.03, backHeight - 0.2, back - 0.005], 0.06), 0, (backHeight + 0.2) / 2, -depth / 2 + 0.005 + (back - 0.005) / 2))
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - armWidth / 2)
      // Rolled arm, swelling a little past the arm’s face.
      const roll = new CylinderGeometry(armRollRadius, armRollRadius, depth - 0.04, 20, 1)
      leather.push(place(roundedBox([armWidth, armTop - 0.2, depth], 0.04), x, (armTop + 0.2) / 2, 0), place(roll.rotateX(Math.PI / 2), x + side * armRollOffset, armTop, 0.01))
    }
    const cushionDepth = depth - back - 0.03
    for (let seat = 0; seat < seats; seat++) {
      const x = (seat - (seats - 1) / 2) * seatWidth
      // The back cushion leans against the frame, its top just below the frame’s.
      const backCushion = roundedBox([seatWidth - 0.025, 0.38, 0.17], 0.07, 4)
      leather.push(place(roundedBox([seatWidth - 0.015, cushionHeight, cushionDepth], 0.06, 4), x, deckTop + cushionHeight / 2, depth / 2 - cushionDepth / 2 - 0.01), place(backCushion.rotateX(-0.2), x, seatHeight + 0.19, -depth / 2 + back + 0.07))
    }
    this.leather = mergeParts(leather)
    const timber: Array<BufferGeometry> = [place(roundedBox([width + 0.02, 0.1, depth + 0.02], 0.015, 2), 0, 0.15, 0)]
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        timber.push(place(new BoxGeometry(0.09, 0.1, 0.09), x * (width / 2 - 0.07), 0.05, z * (depth / 2 - 0.07)))
      }
    }
    this.timber = mergeParts(timber)
  }

  dispose() {
    this.leather.dispose()
    this.timber.dispose()
  }
}
