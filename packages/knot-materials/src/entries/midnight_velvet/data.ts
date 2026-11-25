import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'midnight_velvet',
  candidateId: 'gpt_luna',
  title: 'Midnight Velvet',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Luna',
      slug: 'openai/gpt-5.6-luna',
      effortLevel: 'max',
    },
  },
  flavorText: 'Midnight velvet remembers every hand of light, turning a quiet orbit into a whisper of color.',
  displacement: 0.001,
  placeholder: {
    color: hsl.integer(304, 71, 13.5),
    shading: 'fabric',
  },
} as const satisfies KnotData
