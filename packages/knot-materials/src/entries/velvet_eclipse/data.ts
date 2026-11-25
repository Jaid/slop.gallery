import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_eclipse',
  candidateId: 'gpt_terra',
  title: 'Velvet Eclipse',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Terra',
      slug: 'openai/gpt-5.6-terra',
      effortLevel: 'max',
    },
  },
  flavorText: 'A blackened field of pile drinks the room’s light, then returns it in slow bruised constellations as you pass.',
  placeholder: {
    color: hsl.integer(330, 65, 11),
    shading: 'fabric',
  },
} as const satisfies KnotData
