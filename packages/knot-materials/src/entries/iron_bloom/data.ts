import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: LLxliOfHhDMdNvD; fixture: knot-material-shaders; result: success.
export default {
  id: 'iron_bloom',
  candidateId: 'deepseek',
  title: 'Iron Bloom',
  createdAt: 1_792_272_563,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  displacement: 0.06,
  flavorText: 'A magnetic tide has learned to flower. Black mercury lifts into thorns wherever your gaze comes close, then forgets you and turns back to glass.',
  placeholder: {
    color: hsl.integer(285, 14, 37),
    shading: 'liquid',
  },
} as const satisfies KnotData
