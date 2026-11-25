import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5RXWnszENQQH6u3; fixture: knot-material-shaders; result: success.
export default {
  id: 'soap_film',
  candidateId: 'space_bunny',
  title: 'Soap Film',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Soap does not have a colour. It has a thickness, and the light it refuses to reflect is the colour you see.',
  placeholder: {
    color: hsl.integer(273, 100, 91.5),
    shading: 'glass',
  },
} as const satisfies KnotData
