import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nacre_tide',
  candidateId: 'grok',
  title: 'Nacre Tide',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The shell remembers every tide as a thinner color than the one before it.',
  placeholder: {
    color: hsl.integer(39, 7, 84),
    shading: 'glass',
  },
} as const satisfies KnotData
