import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: LLxliOfHhDMdNvD; fixture: knot-material-shaders; result: success.
export default {
  id: 'rose_window',
  candidateId: 'deepseek',
  title: 'Rose Window',
  createdAt: 1_792_272_563,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A rose of lead and jewel glass, lit by a sun that follows no one. Circle it, and the colors rearrange themselves into a new prayer.',
  placeholder: {
    color: hsl.integer(343, 28, 44),
    shading: 'glass',
  },
} as const satisfies KnotData
