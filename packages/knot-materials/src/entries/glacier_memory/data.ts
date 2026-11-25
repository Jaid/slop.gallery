import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'glacier_memory',
  candidateId: 'grok',
  title: 'Glacier Memory',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Old seasons stay stacked in the ice, each one a little bluer than the light that made it.',
  displacement: 0.003,
  placeholder: {
    color: hsl.integer(226, 56, 74),
    shading: 'glass',
  },
} as const satisfies KnotData
