import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lenticular_mirage',
  candidateId: 'gpt_astra',
  title: 'Lenticular Mirage',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'A step to either side reveals the image that the last angle concealed.',
  placeholder: {
    color: hsl.integer(193, 77, 90),
    shading: 'smooth',
  },
} as const satisfies KnotData
