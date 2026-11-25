import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2tmj6W7XIniDLsB; fixture: knot-material-shaders; result: success.
export default {
  id: 'koi_ascendant',
  candidateId: 'gpt_sol',
  title: 'Koi Ascendant',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Golden koi swim an endless river of lacquer. Vermilion fins breathe against the black; tiny scales carry the daylight you bring to their water.',
  placeholder: {
    color: hsl.integer(180, 79, 17),
    shading: 'smooth',
  },
} as const satisfies KnotData
