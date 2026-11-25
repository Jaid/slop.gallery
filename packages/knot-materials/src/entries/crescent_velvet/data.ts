import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'crescent_velvet',
  candidateId: 'gpt_terra',
  title: 'Crescent Velvet',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Midnight pile absorbs the room until a constellation of warm crescents wakes beneath your gaze.',
  placeholder: {
    color: hsl.integer(338, 59, 14),
    shading: 'fabric',
  },
} as const satisfies KnotData
