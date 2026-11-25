import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BJsZFlj5mQPSiFo; fixture: knot-material-shaders.
export default {
  id: 'tidal_glass',
  candidateId: 'space_bunny',
  title: 'Tidal Glass',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A transparent tide keeps the moon’s reflection folded safely inside its glass.',
  placeholder: {
    color: hsl.integer(197, 90, 57),
    shading: 'glass',
  },
  displacement: 0.000027,
} as const satisfies KnotData
