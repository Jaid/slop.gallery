import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_crucible',
  candidateId: 'gemini_flash',
  title: 'Bismuth Crucible',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Oxidized terraces descend into geometric stairwells where molten rainbow metal freezes into eternal hopper crystals.',
  displacement: 0.053,
  placeholder: {
    color: hsl.integer(308, 52, 58),
    shading: 'metal',
  },
} as const satisfies KnotData
