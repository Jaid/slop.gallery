import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'verdant_oath',
  candidateId: 'gpt_astra',
  title: 'Verdant Oath',
  createdAt: 1_790_122_624,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'On a lacquer night, golden ginkgo leaves promise to remember the sun. Their veins brighten when a witness passes.',
  placeholder: {
    color: hsl.integer(161, 46, 36),
    shading: 'smooth',
  },
} as const satisfies KnotData
