import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'obsidian_kintsugi',
  candidateId: 'gemini_flash',
  title: 'Obsidian Kintsugi',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Fractured volcanic glass finds peace where molten seams of sacred gold mend every forgotten wound.',
  placeholder: {
    color: hsl.integer(29, 14, 9),
    shading: 'glass',
  },
} as const satisfies KnotData
