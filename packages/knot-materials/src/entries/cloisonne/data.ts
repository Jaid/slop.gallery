import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cloisonne',
  candidateId: 'grok',
  title: 'Cloisonné',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.011,
  flavorText: 'Jewel glass, poured into gardens of gold wire. Each cell is a chapel the size of a fingernail, and its window of shine follows you.',
  placeholder: {
    color: hsl.integer(261, 90, 23),
    shading: 'glass',
  },
} as const satisfies KnotData
