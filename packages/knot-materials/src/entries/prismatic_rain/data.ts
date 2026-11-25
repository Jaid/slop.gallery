import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'prismatic_rain',
  candidateId: 'gpt_luna',
  title: 'Prismatic Rain',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Luna',
      slug: 'openai/gpt-5.6-luna',
      effortLevel: 'max',
    },
  },
  flavorText: 'A storm is held in clear glass: droplets catch the gallery, split it into rainbows and drift through one another.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(257, 44, 32),
    shading: 'glass',
  },
} as const satisfies KnotData
