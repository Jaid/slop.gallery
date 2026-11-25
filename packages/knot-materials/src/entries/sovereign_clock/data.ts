import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4cRctoZrXREvmK4; fixture: knot-material-shaders; result: success.
export default {
  id: 'sovereign_clock',
  candidateId: 'gpt_sol',
  title: 'Sovereign Clock',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'A kingdom of brass turns beneath ruby bearings. Its patient machinery measures not the hours, but the moments you choose to stay.',
  placeholder: {
    color: hsl.integer(79, 60, 64),
    shading: 'metal',
  },
} as const satisfies KnotData
