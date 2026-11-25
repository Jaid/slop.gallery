import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'amber_orchard',
  candidateId: 'gpt_astra',
  title: 'Amber Orchard',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'An orchard sleeps in a drop of ancient sunlight. Move gently: every suspended frond remembers a different depth of time.',
  placeholder: {
    color: hsl.integer(67, 82, 55),
    shading: 'glass',
  },
} as const satisfies KnotData
