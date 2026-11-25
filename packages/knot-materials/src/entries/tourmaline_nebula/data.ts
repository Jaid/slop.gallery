import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BJsZFlj5mQPSiFo; fixture: knot-material-shaders.
export default {
  id: 'tourmaline_nebula',
  candidateId: 'space_bunny',
  title: 'Tourmaline Nebula',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A dark tourmaline crystal contains a weather system from a planet that has no name.',
  placeholder: {
    color: hsl.integer(287, 76, 14),
    shading: 'glass',
  },
  displacement: 0.000032,
} as const satisfies KnotData
