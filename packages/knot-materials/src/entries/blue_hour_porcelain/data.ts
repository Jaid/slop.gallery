import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 0CPX47Y7FuE0PTN.
export default {
  id: 'blue_hour_porcelain',
  candidateId: 'gpt_sol',
  title: 'Blue Hour Porcelain',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Cobalt monsoons travel through a porcelain sky, leaving hand-painted clouds and rain in their wake.',
  placeholder: {
    color: hsl.integer(101, 21, 86),
    shading: 'smooth',
  },
} as const satisfies KnotData
