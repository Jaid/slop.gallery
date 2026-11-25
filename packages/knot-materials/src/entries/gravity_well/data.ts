import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gravity_well',
  candidateId: 'gpt_astra',
  title: 'Gravity Well',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'Reflections lean toward a center that offers nothing in return.',
  placeholder: {
    color: hsl.integer(58, 100, 80),
    shading: 'ghost',
  },
} as const satisfies KnotData
