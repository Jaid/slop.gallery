import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'velvet_nebula',
  candidateId: 'grok',
  title: 'Velvet Nebula',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Cloth so dark it keeps a galaxy, and gives it back only at a slant.',
  placeholder: {
    color: hsl.integer(310, 51, 11),
    shading: 'fabric',
  },
} as const satisfies KnotData
