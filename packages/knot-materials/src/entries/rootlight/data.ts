import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HU72JSGdKyp7pBO; fixture: knot-material-shaders; result: success.
export default {
  id: 'rootlight',
  candidateId: 'gpt_sol',
  title: 'Rootlight',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  displacement: 0.006,
  flavorText: 'Beneath the world, a patient choir trades tiny suns through roots of ivory. Nothing here is alone.',
  placeholder: {
    color: hsl.integer(81, 39, 47),
    shading: 'fabric',
  },
} as const satisfies KnotData
