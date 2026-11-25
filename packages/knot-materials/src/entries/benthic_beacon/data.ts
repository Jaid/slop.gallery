import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'benthic_beacon',
  candidateId: 'gpt_astra',
  title: 'Benthic Beacon',
  createdAt: 1_791_852_458,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'One small beacon keeps watch at the bottom of the world.',
  placeholder: {
    color: hsl.integer(221, 100, 78.8),
    shading: 'glass',
  },
} as const satisfies KnotData
