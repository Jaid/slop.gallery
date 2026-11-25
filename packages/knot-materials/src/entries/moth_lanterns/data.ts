import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 0CPX47Y7FuE0PTN.
export default {
  id: 'moth_lanterns',
  candidateId: 'gpt_sol',
  title: 'Moth Lanterns',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'At twilight, luminous wings beat soundlessly under translucent green skin, carrying fireflies toward the center of the knot.',
  placeholder: {
    color: hsl.integer(167, 77, 28),
    shading: 'glass',
  },
} as const satisfies KnotData
