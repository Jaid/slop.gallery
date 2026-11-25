import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'pavonine_vow',
  candidateId: 'gpt_astra',
  title: 'Pavonine Vow',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A thousand enamel feathers hold their breath. Walk past, and the colors of an impossible bird quietly turn to follow.',
  placeholder: {
    color: hsl.integer(188, 66, 49),
    shading: 'smooth',
  },
} as const satisfies KnotData
