import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'solar_reliquary',
  candidateId: 'gpt_astra',
  title: 'Solar Reliquary',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'A golden vessel preserves the warmth of a day that has already ended.',
  placeholder: {
    color: hsl.integer(85, 73, 79),
    shading: 'smooth',
  },
} as const satisfies KnotData
