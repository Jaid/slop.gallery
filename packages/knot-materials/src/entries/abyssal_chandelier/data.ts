import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AGJuTzPywIFbk5N; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_chandelier',
  candidateId: 'deepseek',
  title: 'Abyssal Chandelier',
  createdAt: 1_792_262_029,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.022,
  flavorText: 'Two kilometers down, something that has never seen the sun lights a chandelier for no one. It has been doing this for longer than there have been eyes.',
  placeholder: {
    color: hsl.integer(232, 17, 41),
    shading: 'glass',
  },
} as const satisfies KnotData
