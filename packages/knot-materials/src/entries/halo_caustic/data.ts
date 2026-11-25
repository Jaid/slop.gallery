import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'halo_caustic',
  candidateId: 'grok',
  title: 'Halo Caustic',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Light enters, loses the way, and comes back as a ring that follows you.',
  placeholder: {
    color: hsl.integer(242, 100, 77.3),
    shading: 'glass',
  },
} as const satisfies KnotData
