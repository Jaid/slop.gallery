import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'prism_archive',
  candidateId: 'gpt_astra',
  title: 'Prism Archive',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Light was folded into a silver archive. Each angle unlocks another spectrum; each step rewrites what you thought you saw.',
  placeholder: {
    color: hsl.integer(233, 16, 74),
    shading: 'metal',
  },
} as const satisfies KnotData
