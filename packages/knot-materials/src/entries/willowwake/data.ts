import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: FLhq233R9MU4dj1; fixture: knot-material-shaders; result: success.
export default {
  id: 'willowwake',
  candidateId: 'gpt_sol',
  title: 'Willowwake',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Blue gardens sleep in bone-white porcelain. Come close: the painted leaves remember spring, and hairline gold mends the winter.',
  placeholder: {
    color: hsl.integer(90, 46, 91.7),
    shading: 'smooth',
  },
} as const satisfies KnotData
