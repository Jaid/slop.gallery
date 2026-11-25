import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5WDU20J87Ktg4fx; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'petrol_aurora',
  candidateId: 'claude_sonnet',
  title: 'Petrol Aurora',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Rain fell on a midnight road and a single drop of oil unrolled across it, thin enough to hold every color the sky forgot.',
  placeholder: {
    color: hsl.integer(272, 24, 17),
    shading: 'liquid',
  },
} as const satisfies KnotData
