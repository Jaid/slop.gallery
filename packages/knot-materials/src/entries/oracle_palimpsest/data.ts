import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'oracle_palimpsest',
  candidateId: 'gpt_sol',
  title: 'Oracle Palimpsest',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Erased prophecies rise through warm vellum in indigo breath, beneath an alphabet illuminated with gold.',
  placeholder: {
    color: hsl.integer(69, 51, 56),
    shading: 'fabric',
  },
} as const satisfies KnotData
