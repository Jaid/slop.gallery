import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mycelial_lantern',
  candidateId: 'gpt_sol',
  title: 'Mycelial Lantern',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'A web of living filaments shares one gentle light among many paths.',
  placeholder: {
    color: hsl.integer(127.7, 100, 91.9),
    shading: 'fabric',
  },
} as const satisfies KnotData
