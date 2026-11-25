import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'heartwood_hymn',
  candidateId: 'gpt_astra',
  title: 'Heartwood Hymn',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'The tree is gone; its years are not. Beneath the polish, a slow golden season travels through the grain.',
  placeholder: {
    color: hsl.integer(45, 55, 27),
    shading: 'smooth',
  },
} as const satisfies KnotData
