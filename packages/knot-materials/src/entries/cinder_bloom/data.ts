import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cinder_bloom',
  candidateId: 'gpt_terra',
  title: 'Cinder Bloom',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Cooling obsidian remembers the instant it flowered, holding embers beneath a skin of ash and glaze.',
  displacement: 0.004,
  placeholder: {
    color: hsl.integer(33, 57, 22),
    shading: 'stone',
  },
} as const satisfies KnotData
