import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'obsidian_bioluminescence',
  candidateId: 'qwen_max',
  title: 'Obsidian Leviathan',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'Living light has found a home in the cracks of volcanic glass.',
  placeholder: {
    color: hsl.integer(209, 100, 82),
    shading: 'liquid',
  },
} as const satisfies KnotData
