import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HdWJtzJ2GnPe32p; fixture: knot-material-shaders; result: success.
export default {
  id: 'feldspar_veil',
  candidateId: 'space_bunny',
  title: 'Feldspar Veil',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Under a mirror polish the feldspar keeps a cold fire of its own, and it only shows itself to whoever moves.',
  placeholder: {
    color: hsl.integer(257, 17, 22),
    shading: 'stone',
  },
} as const satisfies KnotData
