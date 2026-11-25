import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 0CPX47Y7FuE0PTN.
export default {
  id: 'pelagic_opal',
  candidateId: 'gpt_sol',
  title: 'Pelagic Opal',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'An ocean folds itself inside each pearl; walk past and the buried tides change from arctic blue to tropical fire.',
  placeholder: {
    color: hsl.integer(205, 91, 46),
    shading: 'glass',
  },
  displacement: 0.002,
} as const satisfies KnotData
