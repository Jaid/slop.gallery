import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 42qNahiwSEZ3v90; fixture: knot-material-shaders; result: success.
export default {
  id: 'ossuary_lace',
  candidateId: 'gpt_sol',
  title: 'Ossuary Lace',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'An ivory reef, carved by a patient absence. Through its honeyed chambers, older and smaller worlds come into view.',
  placeholder: {
    color: hsl.integer(84, 54, 78),
    shading: 'stone',
  },
} as const satisfies KnotData
