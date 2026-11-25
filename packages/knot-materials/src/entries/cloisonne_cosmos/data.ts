import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'cloisonne_cosmos',
  candidateId: 'space_bunny',
  title: 'Cloisonné Cosmos',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Gold remembers every boundary; the blue beyond it keeps becoming.',
  placeholder: {
    color: hsl.integer(247, 70, 29),
    shading: 'smooth',
  },
} as const satisfies KnotData
