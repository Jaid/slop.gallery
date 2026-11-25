import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HdWJtzJ2GnPe32p; fixture: knot-material-shaders; result: success.
export default {
  id: 'morpho_wing',
  candidateId: 'space_bunny',
  title: 'Morpho Wing',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A thousand lamellae of chitin, each one a tilted grating, agree to be blue only while you are standing in exactly the right place.',
  placeholder: {
    color: hsl.integer(243, 99.9, 66),
    shading: 'fabric',
  },
} as const satisfies KnotData
