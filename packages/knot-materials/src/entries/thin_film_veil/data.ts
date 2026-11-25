import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'thin_film_veil',
  candidateId: 'claude_opus',
  title: 'Thin Film Veil',
  createdAt: 1_789_575_270,
  harness: 'none',
  author: {
    model: {
      title: 'Claude Opus 5',
      slug: 'anthropic/claude-opus-5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A film thinner than a breath turns ordinary light into a passing rainbow.',
  placeholder: {
    color: hsl.integer(301, 100, 76),
    shading: 'glass',
  },
} as const satisfies KnotData
