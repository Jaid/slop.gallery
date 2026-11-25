import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'imperial_porcelain',
  candidateId: 'gpt_astra',
  title: 'Imperial Porcelain',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'A flawless glaze preserves the calm of an empty ceremonial hall.',
  placeholder: {
    color: hsl.integer(265, 84, 49),
    shading: 'stone',
  },
} as const satisfies KnotData
