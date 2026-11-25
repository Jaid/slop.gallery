import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2tmj6W7XIniDLsB; fixture: knot-material-shaders; result: success.
export default {
  id: 'cobalt_orchard',
  candidateId: 'gpt_sol',
  title: 'Cobalt Orchard',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'An orchard painted in cobalt dreams beneath porcelain. Gold pollen awakens when you approach; each blossom holds the memory of a blue dawn.',
  placeholder: {
    color: hsl.integer(92, 43, 91),
    shading: 'smooth',
  },
} as const satisfies KnotData
