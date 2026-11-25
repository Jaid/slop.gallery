import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: DyugOIRGq3AJL3h; fixture: knot-material-br11k.
export default {
  id: 'felidae_nocturne',
  candidateId: 'gpt_sol',
  title: 'Felidae Nocturne',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'An atlas of small, impossible hunters: each life is a handful of lights, held together by the dark between them.',
  placeholder: {
    color: hsl.integer(257, 62, 22),
    shading: 'smooth',
  },
} as const satisfies KnotData
