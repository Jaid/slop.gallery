import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'magnetic_tide',
  candidateId: 'gpt_astra',
  title: 'Magnetic Tide',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A black sea kneels to an invisible moon. Its polished ridges rise, hesitate and dissolve into the next impossible tide.',
  displacement: 0.03,
  placeholder: {
    color: hsl.integer(246, 15, 42),
    shading: 'liquid',
  },
} as const satisfies KnotData
