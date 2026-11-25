import type {RoomPortraitSlot} from '../base/Room.ts'
import type {StudioPlan} from './plan.ts'

/** how far a work’s face stands out from the wall’s face */
const standOff = 0.115
/** the ratio of the Studio’s one slot, which its own catalog’s works fill by default */
export const studioSlotRatio = '16:9'

/** The Studio’s one slot, a wide one on the north wall of a Studio over the clear floor `clear`, `along` meters east of the north-western corner, which every room size keeps in the same place, centered 2 m over the floor. */
export default function studioSlots([width, depth]: StudioPlan['clear'], along: number) {
  return {
    north: {
      wallId: 'north',
      ratio: studioSlotRatio,
      area: 15_000,
      position: [-width / 2 + along, 2, -depth / 2 + standOff],
      rotation: 0,
    },
  } satisfies Record<string, RoomPortraitSlot>
}
