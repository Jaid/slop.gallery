import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ruby_asterism',
  candidateId: 'deepseek',
  title: 'Ruby Asterism',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A ruby grown around needle-thin silk: turn it and a star of six rays wheels across the dome, leaving as you arrive.',
  placeholder: {
    color: hsl.integer(21, 91, 29),
    shading: 'glass',
  },
} as const satisfies KnotData
