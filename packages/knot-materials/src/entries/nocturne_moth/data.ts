import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'nocturne_moth',
  candidateId: 'gpt_astra',
  title: 'Nocturne Moth',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'Dust-soft wings carry the quiet colors of a garden after sunset.',
  placeholder: {
    color: hsl.integer(177, 75, 76.5),
    shading: 'fabric',
  },
} as const satisfies KnotData
