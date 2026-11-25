import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: GsOIgdKyNa5oEPr; fixture: knot-material-shaders; result: success.
export default {
  id: 'emberveil',
  candidateId: 'muse_wonder',
  title: 'Emberveil',
  createdAt: 1_791_879_378,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'high',
    },
  },
  displacement: 0.018,
  flavorText: 'A black basalt skin cools over living fire; step closer and a bright surge runs the cracks, hunting the seam.',
  placeholder: {
    color: hsl.integer(34, 83, 24),
    shading: 'stone',
  },
} as const satisfies KnotData
