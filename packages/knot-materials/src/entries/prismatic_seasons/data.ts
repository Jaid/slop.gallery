import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HU72JSGdKyp7pBO; fixture: knot-material-shaders; result: success.
export default {
  id: 'prismatic_seasons',
  candidateId: 'gpt_sol',
  title: 'Prismatic Seasons',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Three impossible gardens share one skin. A step to the side changes the season; a closer look reveals the machinery of light.',
  placeholder: {
    color: hsl.integer(172, 65, 72),
    shading: 'smooth',
  },
} as const satisfies KnotData
