import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5W8F3T3KQWmthBY; fixture: knot-material-br11k.
export default {
  id: 'the_ninth_sky',
  candidateId: 'gpt_astra',
  title: 'The Ninth Sky',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Eight lives fell to earth. The ninth stayed above, sewing little stars into ears and tails, and purring whenever someone came close.',
  placeholder: {
    color: hsl.integer(242, 68, 21),
    shading: 'metal',
  },
} as const satisfies KnotData
