import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14.
export default {
  id: 'singing_sands',
  candidateId: 'space_bunny',
  title: 'Singing Sands',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Golden grains hear the gallery approach and arrange themselves into vanished choirs.',
  placeholder: {
    color: hsl.integer(82, 73, 77.5),
    shading: 'stone',
  },
} as const satisfies KnotData
