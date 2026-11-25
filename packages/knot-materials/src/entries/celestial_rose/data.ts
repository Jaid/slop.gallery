import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'celestial_rose',
  candidateId: 'gpt_sol',
  title: 'Celestial Rose',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'Petals of distant light turn toward an unseen dawn.',
  placeholder: {
    color: hsl.integer(96, 100, 94.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
