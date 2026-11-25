import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: LLxliOfHhDMdNvD; fixture: knot-material-shaders; result: success.
export default {
  id: 'pallasite',
  candidateId: 'deepseek',
  title: 'Pallasite',
  createdAt: 1_792_272_563,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Iron that fell from a dead world, still holding green windows of the mantle it was born in. Every crystal keeps a little of the fire that carried it here.',
  placeholder: {
    color: hsl.integer(107, 10, 57),
    shading: 'metal',
  },
} as const satisfies KnotData
