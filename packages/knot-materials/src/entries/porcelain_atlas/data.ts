import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'porcelain_atlas',
  candidateId: 'gpt_astra',
  title: 'Porcelain Atlas',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Cobalt seas migrate beneath a porcelain sky. The gold meridians remain, mapping countries that have not yet dreamed of land.',
  placeholder: {
    color: hsl.integer(239, 19, 80),
    shading: 'smooth',
  },
} as const satisfies KnotData
