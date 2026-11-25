import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'velvet_occultation',
  candidateId: 'space_bunny',
  title: 'Velvet Occultation',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'On a midnight thread, cats assemble from starlight and refuse to be named.',
  placeholder: {
    color: hsl.integer(283, 74, 11),
    shading: 'smooth',
  },
} as const satisfies KnotData
