import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_herbarium',
  candidateId: 'gpt_astra',
  title: 'Amber Herbarium',
  createdAt: 1_790_122_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'A forest folded into a drop of honey, still dreaming of the wind that once moved its smallest leaves.',
  placeholder: {
    color: hsl.integer(66, 85, 58),
    shading: 'glass',
  },
} as const satisfies KnotData
