import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'chrome_bloom',
  candidateId: 'space_bunny',
  title: 'Chrome Bloom',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A living alloy learns the color of every sky, then keeps one impossible sunrise.',
  placeholder: {
    color: hsl.integer(221, 34, 79),
    shading: 'metal',
  },
} as const satisfies KnotData
