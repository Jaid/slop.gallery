import type {Lamp} from '../base/Room.ts'

import forge, {forgeVestibule} from '#src/lib/gallery/forge.ts'
import forgeCeiling, {forgePendantSpots} from '#src/lib/gallery/forgeCeiling.ts'

const tableLamp = (x: number, z: number): Lamp => ({
  position: [x, forgeCeiling.pendants.lightY, z],
  strength: 34,
  tint: '#ffc168',
  range: 11,
  decay: 1.75,
})
const benchLamp = (x: number, z: number): Lamp => ({
  position: [x, forgeCeiling.pendants.lightY, z],
  strength: 28,
  tint: '#ffbc60',
  range: 9.5,
  decay: 1.75,
})

// Six unshadowed warm workshop pendants hung over the four soapstone tables and flanking the south alchemy workbench, plus a gentle warm lantern glow high in the vestibule cupola; the midday sun through the clerestory monitor provides the room’s directional shadows and shafts.
export default {
  ...Object.fromEntries(forgePendantSpots.map(({id, x, z}) => [id, id.startsWith('bench_') ? benchLamp(x, z) : tableLamp(x, z)])) as Record<typeof forgePendantSpots[number]['id'], Lamp>,
  vestibule: {
    position: [forgeVestibule.center[0] - forge.center[0], 5.4, forgeVestibule.center[1] - forge.center[1]],
    strength: 14,
    tint: '#ffc878',
    range: 8.5,
    decay: 1.8,
  },
} satisfies Record<string, Lamp>
