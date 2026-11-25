import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'moth_reliquary',
  candidateId: 'grok',
  title: 'Moth Reliquary',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Dust from a moth that learned stained glass. It brightens only for whoever bothers to come close.',
  placeholder: {
    color: hsl.integer(57, 61, 57),
    shading: 'fabric',
  },
} as const satisfies KnotData
