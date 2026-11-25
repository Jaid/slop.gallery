import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AGJuTzPywIFbk5N; fixture: knot-material-shaders; result: success.
export default {
  id: 'sunwheel',
  candidateId: 'deepseek',
  title: 'Sunwheel',
  createdAt: 1_792_262_029,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.009,
  flavorText: 'A rose engine once tried to engrave the sun. This is the dial it left behind: blue enamel night, gold rays, and a heartbeat under glass.',
  placeholder: {
    color: hsl.integer(274, 53, 34),
    shading: 'smooth',
  },
} as const satisfies KnotData
