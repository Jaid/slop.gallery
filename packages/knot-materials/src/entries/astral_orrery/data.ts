import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'astral_orrery',
  candidateId: 'deepseek',
  title: 'Astral Orrery',
  createdAt: 1_789_094_423,
  harness: 'none',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Small heavens keep their appointments around an invisible sun.',
  placeholder: {
    color: hsl.integer(86, 100, 86),
    shading: 'smooth',
  },
} as const satisfies KnotData
