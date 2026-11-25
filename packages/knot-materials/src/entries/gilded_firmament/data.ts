import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: LLxliOfHhDMdNvD; fixture: knot-material-shaders; result: success.
export default {
  id: 'gilded_firmament',
  candidateId: 'deepseek',
  title: 'Gilded Firmament',
  createdAt: 1_792_272_563,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'max',
    },
  },
  flavorText: 'Ten thousand gold leaves were laid by candlelight into a sky of lapis. Walk past, and every tile takes its turn holding the sun.',
  placeholder: {
    color: hsl.integer(316, 25, 48),
    shading: 'smooth',
  },
} as const satisfies KnotData
