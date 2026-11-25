import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'obsidian_bloom',
  candidateId: 'deepseek',
  title: 'Obsidian Bloom',
  createdAt: 1_789_075_137,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.013,
  flavorText: 'A mirror of cooled night, split by the bloom of the fire still living underneath it.',
  placeholder: {
    color: hsl.integer(44, 74, 7),
    shading: 'glass',
  },
} as const satisfies KnotData
