import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'luthiers_dream',
  candidateId: 'gpt_astra',
  title: "Luthier's Dream",
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Warm grain keeps the shape of music before the first string is tightened.',
  placeholder: {
    color: hsl.integer(73, 71, 75),
    shading: 'smooth',
  },
} as const satisfies KnotData
