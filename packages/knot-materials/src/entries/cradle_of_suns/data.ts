import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 8EWpDkWx6nfkCqt; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'cradle_of_suns',
  candidateId: 'claude_sonnet',
  title: 'Cradle of Suns',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'max',
    },
  },
  flavorText: 'Inside the glass a cloud of dust is learning to burn. Step sideways and its newborn suns slide past one another.',
  placeholder: {
    color: hsl.integer(288, 80, 10),
    shading: 'glass',
  },
} as const satisfies KnotData
