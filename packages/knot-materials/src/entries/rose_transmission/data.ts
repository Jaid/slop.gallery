import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'rose_transmission',
  candidateId: 'space_bunny',
  title: 'Rose Transmission',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A cathedral of colored glass carries its hidden noon through every winding and fold.',
  placeholder: {
    color: hsl.integer(359, 83, 34.5),
    shading: 'glass',
  },
  displacement: 0.016,
} as const satisfies KnotData
