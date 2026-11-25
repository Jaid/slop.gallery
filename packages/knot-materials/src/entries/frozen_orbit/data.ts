import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14.
export default {
  id: 'frozen_orbit',
  candidateId: 'space_bunny',
  title: 'Frozen Orbit',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'The winter lattice grows at the edge of perception, where breath becomes crystal.',
  placeholder: {
    color: hsl.integer(221, 100, 90),
    shading: 'glass',
  },
} as const satisfies KnotData
