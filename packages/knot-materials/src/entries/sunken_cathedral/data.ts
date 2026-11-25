import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'sunken_cathedral',
  candidateId: 'gpt_astra',
  title: 'Sunken Cathedral',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'An underwater cathedral gathers daylight where its roof once met the sky.',
  placeholder: {
    color: hsl.integer(212, 68, 83),
    shading: 'smooth',
  },
} as const satisfies KnotData
