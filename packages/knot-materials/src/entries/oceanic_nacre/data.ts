import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BJsZFlj5mQPSiFo; fixture: knot-material-shaders.
// Original identity: abyssal_nacre (Abyssal Nacre).
export default {
  id: 'oceanic_nacre',
  candidateId: 'space_bunny',
  title: 'Oceanic Nacre',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Pearl grows in the dark by keeping a little ocean inside every layer.',
  placeholder: {
    color: hsl.integer(237, 69, 24),
    shading: 'smooth',
  },
  displacement: 0.000045,
} as const satisfies KnotData
