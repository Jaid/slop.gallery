import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cinnabar_kiln',
  candidateId: 'grok',
  title: 'Cinnabar Kiln',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The kiln never quite goes out. Heat keeps rewriting the glaze in a slower alphabet than fire.',
  placeholder: {
    color: hsl.integer(25, 90, 36),
    shading: 'smooth',
  },
} as const satisfies KnotData
