import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'night_warp',
  candidateId: 'grok',
  title: 'Night Warp',
  createdAt: 1_791_852_458,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Night is the warp. Everything colored is only a thread that refused to stay in the dark.',
  placeholder: {
    color: hsl.integer(215, 74, 29),
    shading: 'fabric',
  },
} as const satisfies KnotData
