import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'caustic_chapel',
  candidateId: 'grok',
  title: 'Caustic Chapel',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.006,
  flavorText: 'A drowned floor of pale tile, where shallow water writes and erases its scripture. Nearer, the letters sharpen. Aside, the surface keeps them.',
  placeholder: {
    color: hsl.integer(188, 45, 60),
    shading: 'glass',
  },
} as const satisfies KnotData
