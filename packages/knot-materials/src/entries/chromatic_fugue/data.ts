import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chromatic_fugue',
  candidateId: 'gpt_astra',
  title: 'Chromatic Fugue',
  createdAt: 1_790_122_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Three paintings share one impossible surface. Walk around it and the lenses conduct an argument between vermilion, jade and midnight.',
  placeholder: {
    color: hsl.integer(359, 56, 39),
    shading: 'glass',
  },
} as const satisfies KnotData
