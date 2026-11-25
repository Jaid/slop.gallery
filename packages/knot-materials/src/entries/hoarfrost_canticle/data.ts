import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IBraVE33noBp60D.
export default {
  id: 'hoarfrost_canticle',
  candidateId: 'gpt_sol',
  title: 'Hoarfrost Canticle',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The cold writes sixfold hymns in glass; each crystal opens another verse as you draw near.',
  placeholder: {
    color: hsl.integer(206, 36, 85),
    shading: 'glass',
  },
} as const satisfies KnotData
