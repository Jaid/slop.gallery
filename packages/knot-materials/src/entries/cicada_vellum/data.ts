import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cicada_vellum',
  candidateId: 'gpt_terra',
  title: 'Cicada Vellum',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A shed wing becomes a luminous manuscript, its copper veins holding the last green warmth of a vanished summer.',
  displacement: 0.009,
  placeholder: {
    color: hsl.integer(65, 56, 50),
    shading: 'glass',
  },
} as const satisfies KnotData
