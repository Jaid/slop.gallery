import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'boreal_glass',
  candidateId: 'grok',
  title: 'Boreal Glass',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.005,
  flavorText: 'Night pressed into ice. Curtains of charged color stand inside it, and they brighten only when the eye travels along their length.',
  placeholder: {
    color: hsl.integer(240, 55, 16),
    shading: 'glass',
  },
} as const satisfies KnotData
