import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4cRctoZrXREvmK4; fixture: knot-material-shaders; result: success.
export default {
  id: 'kiln_memory',
  candidateId: 'gpt_sol',
  title: 'Kiln Memory',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Cobalt gardens remember the hand that painted them. Beneath a thousand hairline fractures, the porcelain is still dreaming of rain.',
  placeholder: {
    color: hsl.integer(105, 33, 90),
    shading: 'smooth',
  },
} as const satisfies KnotData
