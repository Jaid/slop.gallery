import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mosslight_garden',
  candidateId: 'gpt_sol',
  title: 'Mosslight Garden',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'An old forest dreams in miniature; dew catches the stars while blue-green roots trade quiet signals below.',
  displacement: 0.024,
  placeholder: {
    color: hsl.integer(142, 64, 35),
    shading: 'stone',
  },
} as const satisfies KnotData
