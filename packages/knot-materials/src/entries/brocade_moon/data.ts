import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14.
export default {
  id: 'brocade_moon',
  candidateId: 'space_bunny',
  title: 'Brocade Moon',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Moonlight is woven through midnight silk by invisible golden hands.',
  placeholder: {
    color: hsl.integer(306, 69, 20),
    shading: 'fabric',
  },
} as const satisfies KnotData
