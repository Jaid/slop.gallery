import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cardinal_velvet',
  candidateId: 'gpt_astra',
  title: 'Cardinal Velvet',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'Deep crimson keeps the warmth of a room long after its candles fade.',
  placeholder: {
    color: hsl.integer(10, 81, 58),
    shading: 'fabric',
  },
} as const satisfies KnotData
