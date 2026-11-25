import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'harmonic_seal',
  candidateId: 'gpt_astra',
  title: 'Harmonic Seal',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A seal from a civilization that stored its music in light. Tilt the silence and its impossible harmonics return.',
  placeholder: {
    color: hsl.integer(310, 23, 69),
    shading: 'metal',
  },
} as const satisfies KnotData
