import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14; original ID: liquid_mercury.
export default {
  id: 'mercury_sea',
  candidateId: 'space_bunny',
  title: 'Liquid Mercury',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A chrome sea remembers every orbit, then forgets it into a perfect reflection.',
  placeholder: {
    color: hsl.integer(246, 14, 75),
    shading: 'liquid',
  },
  displacement: 0.004,
} as const satisfies KnotData
