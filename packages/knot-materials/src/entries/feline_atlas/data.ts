import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 0CPX47Y7FuE0PTN.
export default {
  id: 'feline_atlas',
  candidateId: 'gpt_sol',
  title: 'Feline Atlas',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Across a midnight sky, entire families of star-cats wake in golden threads, following your footsteps from constellation to constellation.',
  placeholder: {
    color: hsl.integer(258, 57, 18),
    shading: 'smooth',
  },
} as const satisfies KnotData
