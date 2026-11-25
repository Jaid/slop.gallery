import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'aurora_ice',
  candidateId: 'gpt_sol',
  title: 'Aurora Ice',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Polar night lies frozen in clear blue ice while curtains of impossible dawn drift far beneath its surface.',
  placeholder: {
    color: hsl.integer(213, 77, 50),
    shading: 'glass',
  },
} as const satisfies KnotData
