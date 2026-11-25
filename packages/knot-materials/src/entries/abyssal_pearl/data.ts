import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: EC58pRKjMMMNqsv; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_pearl',
  candidateId: 'muse_wonder',
  title: 'Abyssal Pearl',
  createdAt: 1_791_844_628,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A thousand nacre tiles laid by patient tides, each one keeping a different pastel secret from the sun.',
  placeholder: {
    color: hsl.integer(17, 4, 68),
    shading: 'smooth',
  },
} as const satisfies KnotData
