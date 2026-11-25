import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 0CPX47Y7FuE0PTN.
export default {
  id: 'winter_palace',
  candidateId: 'gpt_sol',
  title: 'Winter Palace',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Six-fold frost blossoms beneath an impossible glacier; each step reveals a new blue depth between its glass-clear and snow-soft layers.',
  placeholder: {
    color: hsl.integer(206, 52, 85),
    shading: 'glass',
  },
} as const satisfies KnotData
