import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BJsZFlj5mQPSiFo; fixture: knot-material-shaders.
export default {
  id: 'kintsugi_nebula',
  candidateId: 'space_bunny',
  title: 'Kintsugi Nebula',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'The vessel broke open to the sky, and the golden wound became a constellation.',
  placeholder: {
    color: hsl.integer(285, 52, 10),
    shading: 'smooth',
  },
  displacement: 0.000032,
} as const satisfies KnotData
