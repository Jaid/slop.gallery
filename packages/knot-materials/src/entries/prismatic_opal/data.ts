import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'prismatic_opal',
  candidateId: 'space_bunny',
  title: 'Prismatic Opal',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A pale stone keeps a handful of captured skies, each one a different weather.',
  placeholder: {
    color: hsl.integer(234, 17, 80),
    shading: 'glass',
  },
} as const satisfies KnotData
