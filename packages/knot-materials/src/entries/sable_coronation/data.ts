import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'sable_coronation',
  candidateId: 'gpt_astra',
  title: 'Sable Coronation',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'A royal darkness, sewn with patient suns. The velvet keeps its fire for those who walk beside it.',
  placeholder: {
    color: hsl.integer(6, 74, 18),
    shading: 'fabric',
  },
} as const satisfies KnotData
