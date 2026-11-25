import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tiger_iron',
  candidateId: 'gpt_astra',
  title: 'Tiger Iron',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'Warm bands of iron and gold hold the watchful patience of a sleeping animal.',
  placeholder: {
    color: hsl.integer(74, 83, 75),
    shading: 'metal',
  },
} as const satisfies KnotData
