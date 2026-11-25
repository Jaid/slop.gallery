import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacre_reverie',
  candidateId: 'gpt_astra',
  title: 'Nacre Reverie',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'The moon left its unfinished colors inside a shell. They drift between its silver pages, too softly to become a rainbow.',
  placeholder: {
    color: hsl.integer(346, 16, 76),
    shading: 'glass',
  },
} as const satisfies KnotData
