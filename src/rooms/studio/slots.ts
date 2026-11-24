import type {RoomPortraitSlot} from '../base/Room.ts'
import type {StudioPlan} from './plan.ts'

/** how far a work’s face stands out from the wall’s face */
const standOff = 0.115

/** One slot for each ratio of the catalog, side by side on the north wall of a Studio over the clear floor `clear`, 5 m and 2.5 m from the north-western corner, which every room size keeps in the same place, centered on one line 2 m over the floor. */
export default function studioSlots([width, depth]: StudioPlan['clear']) {
  const wall = -depth / 2 + standOff
  return {
    north_0: {
      wallId: 'north',
      ratio: '3:2',
      area: 15_000,
      position: [-width / 2 + 5, 2, wall],
      rotation: 0,
    },
    north_1: {
      wallId: 'north',
      ratio: '1:1',
      area: 15_000,
      position: [-width / 2 + 2.5, 2, wall],
      rotation: 0,
    },
  } satisfies Record<string, RoomPortraitSlot>
}
