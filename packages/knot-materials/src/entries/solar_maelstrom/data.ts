import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MgSdUInR50wESrr; fixture: knot-material-shaders; result: success.
export default {
  id: 'solar_maelstrom',
  candidateId: 'muse_wonder',
  title: 'Solar Maelstrom',
  createdAt: 1_791_858_712,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.024,
  flavorText: 'A star held still long enough to scar. Black continents of basalt drift on white fire, and every crack remembers the heat that made it.',
  placeholder: {
    color: hsl.integer(72, 99, 80.7),
    shading: 'metal',
  },
} as const satisfies KnotData
