import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HU72JSGdKyp7pBO; fixture: knot-material-shaders; result: success.
export default {
  id: 'sunken_solstice',
  candidateId: 'gpt_sol',
  title: 'Sunken Solstice',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'The last light of a vanished summer, sealed around seeds that never reached the ground. Turn it, and the forest wakes.',
  placeholder: {
    color: hsl.integer(51, 96, 59),
    shading: 'glass',
  },
} as const satisfies KnotData
