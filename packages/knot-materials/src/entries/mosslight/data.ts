import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 42qNahiwSEZ3v90; fixture: knot-material-shaders; result: success.
export default {
  id: 'mosslight',
  candidateId: 'gpt_sol',
  title: 'Mosslight',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.008,
  flavorText: 'The forest has folded its smallest dawn into this green relic. Come close; the sleeping spores will answer.',
  placeholder: {
    color: hsl.integer(140, 68, 42),
    shading: 'fabric',
  },
} as const satisfies KnotData
