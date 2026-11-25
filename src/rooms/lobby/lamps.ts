import type {Lamp} from '../base/Room.ts'

import hsl from 'okhsl'

const chandelier = (z: number) => ({
  position: [0, 6.6, z],
  strength: 7.2,
  tint: hsl.integer(83, 100, 86.6),
  range: 15,
}) satisfies Lamp

// One under each of the vault’s three chandeliers, hung below the hub to reach past the candle ring. They cast no shadow: a shadowed point light would cost six extra renders of the scene every frame.
// The Oculus sees the chandeliers only through the glazed floor and the Salon only through its thick blue window, which both hide their light almost entirely, so neither keeps them on.
export default {
  chandelier_north: chandelier(-8),
  chandelier_middle: chandelier(0),
  chandelier_south: chandelier(8),
} satisfies Record<string, Lamp>
