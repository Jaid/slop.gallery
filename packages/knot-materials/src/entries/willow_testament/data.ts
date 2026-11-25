import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'willow_testament',
  candidateId: 'gpt_astra',
  title: 'Willow Testament',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Blue gardens climb a porcelain moon. Every golden vein remembers the hand that painted it.',
  placeholder: {
    color: hsl.integer(217, 13, 91),
    shading: 'smooth',
  },
} as const satisfies KnotData
