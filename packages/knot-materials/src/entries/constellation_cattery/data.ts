import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'constellation_cattery',
  candidateId: 'grok',
  title: 'Constellation Cattery',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Each cat is a handful of stars that agree, for a moment, to be an animal.',
  placeholder: {
    color: hsl.integer(300, 43, 7.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
