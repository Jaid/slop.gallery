import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: LLxliOfHhDMdNvD; fixture: knot-material-shaders; result: success.
export default {
  id: 'cymatic_psalm',
  candidateId: 'deepseek',
  title: 'Cymatic Psalm',
  createdAt: 1_792_272_563,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'A bronze bell that never rings aloud. Its standing waves comb the dust into scripture, and the verse changes whenever no one is counting.',
  placeholder: {
    color: hsl.integer(73, 34, 51),
    shading: 'metal',
  },
} as const satisfies KnotData
