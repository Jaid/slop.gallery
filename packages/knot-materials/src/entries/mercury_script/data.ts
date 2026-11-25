import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'mercury_script',
  candidateId: 'grok',
  title: 'Mercury Script',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The writing is already finished. It only agrees to be read from the angle you have not tried.',
  placeholder: {
    color: hsl.integer(260, 13, 41),
    shading: 'metal',
  },
} as const satisfies KnotData
