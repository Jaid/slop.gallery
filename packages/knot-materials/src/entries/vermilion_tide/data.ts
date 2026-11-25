import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 42qNahiwSEZ3v90; fixture: knot-material-shaders; result: success.
export default {
  id: 'vermilion_tide',
  candidateId: 'gpt_sol',
  title: 'Vermilion Tide',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Golden koi swim beneath a red lacquer evening. Their wake is a brushstroke that never quite reaches the shore.',
  placeholder: {
    color: hsl.integer(21, 89, 39),
    shading: 'smooth',
  },
} as const satisfies KnotData
