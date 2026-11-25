import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'midnight_prophecy',
  candidateId: 'gpt_sol',
  title: 'Midnight Prophecy',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Moon-dark porcelain remembers every wound in rivers of gold, and whispers through them when you draw near.',
  placeholder: {
    color: hsl.integer(291, 31, 17),
    shading: 'smooth',
  },
} as const satisfies KnotData
