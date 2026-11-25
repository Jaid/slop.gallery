import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'prism_orchard',
  candidateId: 'gpt_astra',
  title: 'Prism Orchard',
  createdAt: 1_789_979_276,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'high',
    },
  },
  flavorText: 'Jewels ripen in an impossible orchard, trading emerald mornings for violet evenings as you pass.',
  placeholder: {
    color: hsl.integer(177, 81, 51),
    shading: 'glass',
  },
} as const satisfies KnotData
