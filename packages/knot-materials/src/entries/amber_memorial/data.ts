import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2tmj6W7XIniDLsB; fixture: knot-material-shaders; result: success.
export default {
  id: 'amber_memorial',
  candidateId: 'gpt_sol',
  title: 'Amber Memorial',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Honey remembers what time forgets. Ferns and drifting seeds hang in a golden depth, shifting behind the glass as you circle their small eternity.',
  placeholder: {
    color: hsl.integer(71, 85, 72),
    shading: 'glass',
  },
} as const satisfies KnotData
