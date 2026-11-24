import type {PointLamp} from '../base/Room.ts'

import {chandelierLampY} from '#src/lib/physics/chandelier.ts'

/** how high the baseboards of the Sandbox’s rooms stand, the two plain walnut bands under the Cell’s damask and the Studio’s alike, and the molded one of the Cell’s round spaces too */
export const sandboxBaseboardHeight = 0.2
/** how much higher the Cell’s chandelier hangs than from the ceiling it is made for, its candles about as high as the top of the hall’s walls */
export const chandelierLift = 0.2
/** how far the lamp of the Cell’s chandelier reaches, in meters */
export const chandelierRange = 25

/** The lamp of the Cell’s chandelier, the Sienna’s, which the Studio has on its own, without the fixture: over the point of the floor plan, relative to the room’s origin, below the chandelier’s metalwork at rest, so the fixture can’t shadow its own source. */
export function chandelierLamp([x, z]: readonly [x: number, z: number]): PointLamp {
  return {
    position: [x, chandelierLampY + chandelierLift, z],
    strength: 50,
    tint: '#ffedc4',
    range: chandelierRange,
    decay: 1.5,
    shadow: true,
  }
}
