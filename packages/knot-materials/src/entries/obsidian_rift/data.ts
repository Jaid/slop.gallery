import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'obsidian_rift',
  candidateId: 'glm',
  title: 'Obsidian Rift',
  createdAt: 1_789_231_507,
  harness: 'chat.z.ai',
  author: {
    model: {
      title: 'GLM 5.3',
      effortLevel: 'max',
    },
  },
  flavorText: 'A narrow opening in black glass reveals that the fire never truly left.',
  placeholder: {
    color: hsl.integer(37.7, 100, 63),
    shading: 'stone',
  },
} as const satisfies KnotData
