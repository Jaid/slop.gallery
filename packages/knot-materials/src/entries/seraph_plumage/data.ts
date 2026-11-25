import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'seraph_plumage',
  candidateId: 'gpt_sol',
  title: 'Seraph Plumage',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'No bird wore these feathers; they molt from a sunrise and kindle as the witness circles them.',
  displacement: 0.007,
  placeholder: {
    color: hsl.integer(45, 74, 56),
    shading: 'fabric',
  },
} as const satisfies KnotData
