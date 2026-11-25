import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14.
export default {
  id: 'pawprint_astrolabe',
  candidateId: 'space_bunny',
  title: 'Pawprint Astrolabe',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Dot by dot, sleeping cats map a kingdom no telescope can reach.',
  placeholder: {
    color: hsl.integer(269, 40, 11),
    shading: 'smooth',
  },
} as const satisfies KnotData
