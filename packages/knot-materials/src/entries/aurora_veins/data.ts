import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'aurora_veins',
  candidateId: 'grok',
  title: 'Aurora Veins',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Polar fire braided under black glass, answering the way you turn.',
  placeholder: {
    color: hsl.integer(184, 72, 22),
    shading: 'glass',
  },
} as const satisfies KnotData
