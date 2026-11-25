import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quasar_silk',
  candidateId: 'gpt_terra',
  title: 'Quasar Silk',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'An impossible loom draws galaxies through midnight thread, rewarding every change of angle with a new current.',
  placeholder: {
    color: hsl.integer(271, 70, 26),
    shading: 'fabric',
  },
} as const satisfies KnotData
