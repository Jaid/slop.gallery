import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'soap_cathedral',
  candidateId: 'grok',
  title: 'Soap Cathedral',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A cathedral blown from one breath, thin enough that daylight has to choose a color to leave.',
  placeholder: {
    color: hsl.integer(209, 36, 76),
    shading: 'glass',
  },
} as const satisfies KnotData
