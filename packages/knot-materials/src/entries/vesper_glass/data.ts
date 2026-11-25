import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'vesper_glass',
  candidateId: 'gpt_astra',
  title: 'Vesper Glass',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The last light of an absent cathedral lingers in these windows, turning slowly from garnet prayer to blue silence.',
  placeholder: {
    color: hsl.integer(323, 29, 39),
    shading: 'glass',
  },
} as const satisfies KnotData
