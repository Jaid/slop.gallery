import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'dune_psalm',
  candidateId: 'gpt_astra',
  title: 'Dune Psalm',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'The desert writes in layers of honey, chalk and rose. Lean close enough and the smallest grains still remember the wind.',
  displacement: 0.01,
  placeholder: {
    color: hsl.integer(67, 53, 71),
    shading: 'stone',
  },
} as const satisfies KnotData
