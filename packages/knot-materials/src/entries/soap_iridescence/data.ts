import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'soap_iridescence',
  candidateId: 'grok',
  title: 'Soap Iridescence',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A breath caught in oil, turning every glance into another color.',
  placeholder: {
    color: hsl.integer(230, 100, 85),
    shading: 'glass',
  },
} as const satisfies KnotData
