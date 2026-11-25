import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_memory',
  candidateId: 'gpt_luna',
  title: 'Amber Memory',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Luna',
      slug: 'openai/gpt-5.6-luna',
      effortLevel: 'max',
    },
  },
  flavorText: 'Sunset sleeps inside old amber: fern shadows, suspended pollen and one impossible summer kept forever.',
  displacement: 0.001,
  placeholder: {
    color: hsl.integer(63, 83, 59),
    shading: 'glass',
  },
} as const satisfies KnotData
