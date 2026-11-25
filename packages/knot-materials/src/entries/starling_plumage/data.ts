import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'starling_plumage',
  candidateId: 'gpt_terra',
  title: 'Starling Plumage',
  createdAt: 1_792_098_068,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Thousands of dark barbs turn as one flock, gathering cobalt and green only at the instant the viewer finds their wind.',
  displacement: 0.009,
  placeholder: {
    color: hsl.integer(186, 59, 22),
    shading: 'fabric',
  },
} as const satisfies KnotData
