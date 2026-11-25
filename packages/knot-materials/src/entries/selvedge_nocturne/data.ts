import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'selvedge_nocturne',
  candidateId: 'gpt_astra',
  title: 'Selvedge Nocturne',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A midnight loom remembers the plumage of an extinct bird. Every passing gaze draws another filament out of the dark.',
  placeholder: {
    color: hsl.integer(204, 61, 34),
    shading: 'fabric',
  },
} as const satisfies KnotData
