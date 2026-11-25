import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'frost_oracle',
  candidateId: 'gpt_terra',
  title: 'Frost Oracle',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A moonlit frost keeps small weather systems and ancient sparks suspended in its translucent blue silence.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(219, 57, 72),
    shading: 'glass',
  },
} as const satisfies KnotData
