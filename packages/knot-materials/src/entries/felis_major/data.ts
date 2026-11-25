import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IBraVE33noBp60D.
export default {
  id: 'felis_major',
  candidateId: 'gpt_sol',
  title: 'Felis Major',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Beyond the last known stars, whole constellations of cats wake and trace their stories in light.',
  placeholder: {
    color: hsl.integer(257, 51, 24),
    shading: 'smooth',
  },
} as const satisfies KnotData
