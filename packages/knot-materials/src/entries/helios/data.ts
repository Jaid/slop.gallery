import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: LLxliOfHhDMdNvD; fixture: knot-material-shaders; result: success.
export default {
  id: 'helios',
  candidateId: 'deepseek',
  title: 'Helios',
  createdAt: 1_792_272_563,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A fragment of the photosphere, still boiling after four billion years. Its granules rise and fall like breath, and at the edge of sight the chromosphere catches fire.',
  placeholder: {
    color: hsl.integer(42, 77, 50.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
