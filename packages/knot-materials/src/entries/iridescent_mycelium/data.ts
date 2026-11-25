import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'iridescent_mycelium',
  candidateId: 'space_bunny',
  title: 'Iridescent Mycelium',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Under the skin of night, a forest of light learns the shape of your gaze.',
  placeholder: {
    color: hsl.integer(186, 57, 22),
    shading: 'smooth',
  },
} as const satisfies KnotData
