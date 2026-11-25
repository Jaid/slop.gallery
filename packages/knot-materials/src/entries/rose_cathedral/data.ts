import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FLhq233R9MU4dj1; fixture: knot-material-shaders; result: success.
export default {
  id: 'rose_cathedral',
  candidateId: 'gpt_sol',
  title: 'Rose Cathedral',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Ruby, jade and amber hold a silent choir. The windows turn inward, and their impossible sun follows you through the nave.',
  placeholder: {
    color: hsl.integer(15, 88, 46.7),
    shading: 'glass',
  },
} as const satisfies KnotData
