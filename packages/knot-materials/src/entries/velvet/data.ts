import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5RXWnszENQQH6u3; fixture: knot-material-shaders; result: success.
export default {
  id: 'velvet',
  candidateId: 'space_bunny',
  title: 'Velvet',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A hundred thousand cut pile fibres, each leaning the same way. Walk past and the cloth turns its colours over for you.',
  placeholder: {
    color: hsl.integer(19, 95, 27),
    shading: 'fabric',
  },
} as const satisfies KnotData
