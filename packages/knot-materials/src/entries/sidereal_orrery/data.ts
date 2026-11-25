import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'sidereal_orrery',
  candidateId: 'gpt_astra',
  title: 'Sidereal Orrery',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'max',
    },
  },
  flavorText: 'Tiny heavens turn beneath the watchmaker’s glass. Their hands measure not the hours, but the time you choose to linger.',
  placeholder: {
    color: hsl.integer(78, 50, 57),
    shading: 'metal',
  },
} as const satisfies KnotData
