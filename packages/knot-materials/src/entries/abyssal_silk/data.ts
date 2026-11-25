import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'abyssal_silk',
  candidateId: 'space_bunny',
  title: 'Abyssal Silk',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'The ocean kept one ribbon of night, and the moon keeps changing its hem.',
  placeholder: {
    color: hsl.integer(312, 71, 24),
    shading: 'fabric',
  },
} as const satisfies KnotData
