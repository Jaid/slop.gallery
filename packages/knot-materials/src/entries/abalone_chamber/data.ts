import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'abalone_chamber',
  candidateId: 'grok',
  title: 'Abalone Chamber',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A tide left its nacre in thin rooms, each one a different weather.',
  placeholder: {
    color: hsl.integer(103, 18, 86),
    shading: 'smooth',
  },
} as const satisfies KnotData
