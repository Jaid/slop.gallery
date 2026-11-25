import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IBraVE33noBp60D.
export default {
  id: 'orrery_nocturne',
  candidateId: 'gpt_sol',
  title: 'Orrery Nocturne',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Tiny planets turn beneath a clockwork midnight, measuring the hours of a sky that never existed.',
  placeholder: {
    color: hsl.integer(67, 57, 61),
    shading: 'metal',
  },
} as const satisfies KnotData
