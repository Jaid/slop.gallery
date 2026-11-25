import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'play_of_color',
  candidateId: 'deepseek',
  title: 'Play of Color',
  createdAt: 1_789_949_253,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Billions of silica spheres vote on a single color; the moment you move, the vote changes.',
  displacement: 0.005,
  placeholder: {
    color: hsl.integer(297, 37, 63),
    shading: 'glass',
  },
} as const satisfies KnotData
