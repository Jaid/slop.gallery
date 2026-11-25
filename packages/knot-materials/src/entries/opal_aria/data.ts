import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: AGJuTzPywIFbk5N; fixture: knot-material-shaders; result: success.
export default {
  id: 'opal_aria',
  candidateId: 'deepseek',
  title: 'Opal Aria',
  createdAt: 1_792_262_029,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.014,
  flavorText: 'A black opal the size of a heartbeat. Every step around it transposes the stone into another key, and the light is the score.',
  placeholder: {
    color: hsl.integer(162, 62, 46),
    shading: 'stone',
  },
} as const satisfies KnotData
