import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'cinnabar_lacquer',
  candidateId: 'grok',
  title: 'Cinnabar Lacquer',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A hundred thin coats, and somewhere under them a vein of gold that knows you are circling.',
  placeholder: {
    color: hsl.integer(29, 97, 35),
    shading: 'smooth',
  },
} as const satisfies KnotData
