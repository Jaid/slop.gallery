import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'glacial_memory',
  candidateId: 'gpt_astra',
  title: 'Glacial Memory',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
    },
  },
  flavorText: 'Layers of blue keep winters that the world above has forgotten.',
  placeholder: {
    color: hsl.integer(217, 100, 91),
    shading: 'glass',
  },
} as const satisfies KnotData
