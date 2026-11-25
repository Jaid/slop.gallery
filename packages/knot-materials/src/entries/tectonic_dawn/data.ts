import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2kVLNNiT7YsY7gP.
export default {
  id: 'tectonic_dawn',
  candidateId: 'space_bunny',
  title: 'Tectonic Dawn',
  createdAt: 1_790_309_623,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Before the first light, the planet opens a seam and lets the hidden sun escape.',
  placeholder: {
    color: hsl.integer(245, 43, 17),
    shading: 'stone',
  },
} as const satisfies KnotData
