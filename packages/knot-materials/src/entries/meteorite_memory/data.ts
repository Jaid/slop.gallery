import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'meteorite_memory',
  candidateId: 'gpt_astra',
  title: 'Meteorite Memory',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'Dark metal carries the scars of a journey longer than the sky.',
  placeholder: {
    color: hsl.integer(243, 18, 81),
    shading: 'smooth',
  },
} as const satisfies KnotData
