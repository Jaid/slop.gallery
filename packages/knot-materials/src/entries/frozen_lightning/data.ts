import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'frozen_lightning',
  candidateId: 'gpt_astra',
  title: 'Frozen Lightning',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'One violent instant has been made quiet enough to hold.',
  placeholder: {
    color: hsl.integer(264, 100, 75.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
