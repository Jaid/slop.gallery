import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'solar_loom',
  candidateId: 'space_bunny',
  title: 'Solar Loom',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Sunlight falls through a woven heaven and arrives as gold, indigo and thunder.',
  placeholder: {
    color: hsl.integer(72, 72, 61),
    shading: 'fabric',
  },
} as const satisfies KnotData
