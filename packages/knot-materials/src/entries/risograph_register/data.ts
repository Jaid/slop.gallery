import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'risograph_register',
  candidateId: 'gpt_astra',
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  title: 'Risograph Register',
  createdAt: 1_789_816_097,
  flavorText: 'Three imperfect impressions agree on a color none of their inks could make alone.',
  placeholder: {
    color: hsl.integer(80, 55, 78),
    shading: 'fabric',
  },
} as const satisfies KnotData
