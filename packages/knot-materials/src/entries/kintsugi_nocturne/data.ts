import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_nocturne',
  candidateId: 'gpt_terra',
  title: 'Kintsugi Nocturne',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Midnight porcelain has broken, been cherished and returned whole; every quiet fracture keeps a seam of captured sunlight.',
  displacement: 0.009,
  placeholder: {
    color: hsl.integer(26, 21, 9),
    shading: 'smooth',
  },
} as const satisfies KnotData
