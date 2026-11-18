import type {PendantMount} from '#src/lib/gallery/pendants/CeilingProbe.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {Lamp} from '../base/Room.ts'

import corridor, {corridorLandingLantern, corridorNorthLantern, corridorSouthLantern} from '#src/lib/gallery/corridor.ts'

/** The source in room coordinates, `below` meters under the lantern body. */
const underLantern = ({light: [x, y, z]}: PendantMount, below = 0.3): Vec3 => [x - corridor.center[0], y - below - corridor.floorY, z - corridor.center[1]]
const lantern = {
  tint: '#ffb363',
} as const

// The middle lantern reaches farthest down the long hall.
export default {
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
    position: underLantern(corridorSouthLantern, 0.4),
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
