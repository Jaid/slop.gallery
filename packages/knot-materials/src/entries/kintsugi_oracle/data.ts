import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'kintsugi_oracle',
  candidateId: 'gpt_luna',
  title: 'Kintsugi Oracle',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Luna',
      slug: 'openai/gpt-5.6-luna',
      effortLevel: 'max',
    },
  },
  flavorText: 'A porcelain prophecy breaks open in gold, and every fracture learns the warmth of your gaze.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(38, 27, 12),
    shading: 'smooth',
  },
} as const satisfies KnotData
