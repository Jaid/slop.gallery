import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kingfisher_enamel',
  candidateId: 'gpt_astra',
  title: 'Kingfisher Enamel',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'A kingfisher left its colors in the furnace. Brass veins now cradle pools of turquoise, lapis and molten honey.',
  placeholder: {
    color: hsl.integer(195, 87, 51),
    shading: 'smooth',
  },
} as const satisfies KnotData
