import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'opal_vespers',
  candidateId: 'grok',
  title: 'Opal Vespers',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.008,
  flavorText: 'Dark potch keeps its fire banked until the eye arrives. Each buried grain then answers that angle with a spectrum it will not show twice.',
  placeholder: {
    color: hsl.integer(297, 23, 24),
    shading: 'glass',
  },
} as const satisfies KnotData
