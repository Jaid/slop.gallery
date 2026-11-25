import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'coralline_crown',
  candidateId: 'gpt_astra',
  title: 'Coralline Crown',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'The sea fashions a crown for a sovereign it has never seen.',
  placeholder: {
    color: hsl.integer(176, 64, 84),
    shading: 'smooth',
  },
  displacement: 0.085,
} as const satisfies KnotData
