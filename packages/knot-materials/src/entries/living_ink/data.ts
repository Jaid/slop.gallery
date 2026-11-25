import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: LLxliOfHhDMdNvD; fixture: knot-material-shaders; result: success.
export default {
  id: 'living_ink',
  candidateId: 'deepseek',
  title: 'Living Ink',
  createdAt: 1_792_272_563,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.01,
  flavorText: 'A skin that thinks in color. Clouds of sepia and teal cross it like weather, and when you come close it raises tiny hills to listen.',
  placeholder: {
    color: hsl.integer(61, 26, 59),
    shading: 'smooth',
  },
} as const satisfies KnotData
