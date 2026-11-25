import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'heartwood_atlas',
  candidateId: 'gpt_astra',
  title: 'Heartwood Atlas',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A thousand summers are folded into this grain. Walk around it and the lost geography of a living tree catches fire without burning.',
  placeholder: {
    color: hsl.integer(50, 59, 50),
    shading: 'smooth',
  },
} as const satisfies KnotData
