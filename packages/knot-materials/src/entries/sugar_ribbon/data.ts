import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'sugar_ribbon',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  title: 'Sugar Ribbon',
  createdAt: 1_789_816_097,
  flavorText: 'A confectioner pulled one last ribbon of raspberry and mint, then forgot where its ends should meet.',
  placeholder: {
    color: hsl.integer(7, 76, 66),
    shading: 'liquid',
  },
  displacement: 0.01,
} as const satisfies KnotData
