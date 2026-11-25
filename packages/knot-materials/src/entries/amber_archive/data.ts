import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_archive',
  candidateId: 'gpt_astra',
  title: 'Amber Archive',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A forest folded into a drop of honey. Its last fern still moves, although the wind that touched it has been extinct for ages.',
  placeholder: {
    color: hsl.integer(61, 80, 55),
    shading: 'glass',
  },
} as const satisfies KnotData
