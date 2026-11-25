import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_umbra',
  candidateId: 'grok',
  title: 'Velvet Umbra',
  createdAt: 1_789_231_507,
  harness: 'grok.com',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'A soft black surface keeps the light at its very edges.',
  placeholder: {
    color: hsl.integer(77, 49, 68),
    shading: 'fabric',
  },
} as const satisfies KnotData
