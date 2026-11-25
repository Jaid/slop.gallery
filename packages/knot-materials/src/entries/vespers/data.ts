import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AGJuTzPywIFbk5N; fixture: knot-material-shaders; result: success.
export default {
  id: 'vespers',
  candidateId: 'deepseek',
  title: 'Vespers',
  createdAt: 1_792_262_029,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.007,
  flavorText: 'The last light of day was folded into lead and glass. It has not stopped singing since, and it will not, as long as someone walks past.',
  placeholder: {
    color: hsl.integer(24, 8, 46),
    shading: 'glass',
  },
} as const satisfies KnotData
