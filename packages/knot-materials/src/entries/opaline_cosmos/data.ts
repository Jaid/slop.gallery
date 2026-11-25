import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opaline_cosmos',
  candidateId: 'gpt_sol',
  title: 'Opaline Cosmos',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'Whole constellations seem to drift beneath this pale, milky sky.',
  placeholder: {
    color: hsl.integer(294, 100, 78.5),
    shading: 'glass',
  },
} as const satisfies KnotData
