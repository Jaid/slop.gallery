import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HdWJtzJ2GnPe32p; fixture: knot-material-shaders; result: success.
export default {
  id: 'crimson_nap',
  candidateId: 'space_bunny',
  title: 'Crimson Nap',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A century of shoulders has brushed the pile flat; the woven vine under it only appears to whoever leans close.',
  placeholder: {
    color: hsl.integer(23, 94, 25),
    shading: 'fabric',
  },
} as const satisfies KnotData
