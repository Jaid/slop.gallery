import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tesseract_projection',
  candidateId: 'qwen_max',
  title: 'Tesseract Projection',
  createdAt: 1_789_231_507,
  harness: 'chat.qwen.ai',
  author: {
    model: {
      title: 'Qwen 3.8 Max',
    },
  },
  flavorText: 'An impossible solid casts a succession of almost-familiar shadows.',
  placeholder: {
    color: hsl.integer(171, 100, 87),
    shading: 'ghost',
  },
} as const satisfies KnotData
