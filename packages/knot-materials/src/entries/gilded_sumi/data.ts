import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gilded_sumi',
  candidateId: 'gpt_terra',
  title: 'Gilded Sumi',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Black lacquer carries a river of gold leaf, its calligraphic current gathering where the light comes to rest.',
  placeholder: {
    color: hsl.integer(87, 56, 43),
    shading: 'smooth',
  },
} as const satisfies KnotData
