import type {PendantMount} from '#src/lib/gallery/pendants/CeilingProbe.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Lamp} from '../base/Room.ts'

import corridor, {corridorLandingLantern, corridorNorthLantern} from '#src/lib/gallery/corridor.ts'

/** The source in room coordinates, 30 cm below the lantern body. */
const underLantern = ({light: [x, y, z]}: PendantMount): Vec3 => [x - corridor.center[0], y - 0.3 - corridor.floorY, z - corridor.center[1]]
const lantern = {
  tint: '#ffb363',
} as const

// Five lanterns: in the doorway passage from the Lodge’s bay, at the north end and in the middle of the long hall, in the open elbow at the foot of the flight and by the Sienna arch at its head; the middle one reaches farthest.
export default {
  lantern_lodge: {
    ...lantern,
    position: [8.7, 2.5, -24.8979],
    strength: 14,
    range: 8,
  },
  lantern_north: {
    ...lantern,
    position: underLantern(corridorNorthLantern),
    strength: 14,
    range: 8,
  },
  lantern_middle: {
    ...lantern,
    position: [0, 2.4, 0],
    strength: 5.6,
    range: 20,
    decay: 1,
  },
  lantern_south: {
    ...lantern,
    position: [0.2929, 2.4, 22.3734],
    strength: 22.4,
    range: 6,
  },
  lantern_landing: {
    ...lantern,
    position: underLantern(corridorLandingLantern),
    strength: 14,
    range: 8,
  },
} satisfies Record<string, Lamp>
