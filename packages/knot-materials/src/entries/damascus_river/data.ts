import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'damascus_river',
  candidateId: 'grok',
  title: 'Damascus River',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.007,
  flavorText: 'Folded a thousand times, the steel remembers every river that quenched it. Turn the blade, and the water wakes along the grain.',
  placeholder: {
    color: hsl.integer(254, 42, 70),
    shading: 'metal',
  },
} as const satisfies KnotData
