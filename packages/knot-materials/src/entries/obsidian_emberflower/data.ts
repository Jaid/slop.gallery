import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'obsidian_emberflower',
  candidateId: 'deepseek',
  title: 'Obsidian Emberflower',
  createdAt: 1_790_125_939,
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
    },
  },
  flavorText: 'A black flower opens along fractures left by an ancient fire.',
  placeholder: {
    color: hsl.integer(43, 100, 68),
    shading: 'fabric',
  },
} as const satisfies KnotData
