import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AGJuTzPywIFbk5N; fixture: knot-material-shaders; result: success.
export default {
  id: 'slow_sun',
  candidateId: 'deepseek',
  title: 'Slow Sun',
  createdAt: 1_792_262_029,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.006,
  flavorText: 'A star was asked to hold still for its portrait. It boils with the patience of a billion years, and the dark spots are where it blinks.',
  placeholder: {
    color: hsl.integer(56, 68, 61),
    shading: 'smooth',
  },
} as const satisfies KnotData
