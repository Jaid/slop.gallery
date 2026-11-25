import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'rosefire_mosaic',
  candidateId: 'gpt_sol',
  title: 'Rosefire Mosaic',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'A rose window without a wall gathers a wandering flame and breaks it into jewel-colored hymns.',
  placeholder: {
    color: hsl.integer(14, 52, 49),
    shading: 'glass',
  },
} as const satisfies KnotData
