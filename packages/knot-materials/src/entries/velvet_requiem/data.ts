import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_requiem',
  candidateId: 'grok',
  title: 'Velvet Requiem',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Pile this deep either drinks the light or gives it back, according to the way you face. Gold thread waits in the nap for a grazing eye.',
  placeholder: {
    color: hsl.integer(22, 97.4, 44),
    shading: 'fabric',
  },
} as const satisfies KnotData
