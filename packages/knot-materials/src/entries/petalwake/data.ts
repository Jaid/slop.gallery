import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 42qNahiwSEZ3v90; fixture: knot-material-shaders; result: success.
export default {
  id: 'petalwake',
  candidateId: 'gpt_sol',
  title: 'Petalwake',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A thousand shells remember being flowers. Their porcelain blush turns to sea-green fire when you pass.',
  placeholder: {
    color: hsl.integer(45, 61, 90),
    shading: 'smooth',
  },
} as const satisfies KnotData
