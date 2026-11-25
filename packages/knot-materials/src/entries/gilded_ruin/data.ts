import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5RXWnszENQQH6u3; fixture: knot-material-shaders; result: success.
export default {
  id: 'gilded_ruin',
  candidateId: 'space_bunny',
  title: 'Gilded Ruin',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.02,
  flavorText: 'A bowl broke, and a stranger poured gold into every wound until the ruin learned to shine. The seams are the whole story now.',
  placeholder: {
    color: hsl.integer(51, 32, 4),
    shading: 'smooth',
  },
} as const satisfies KnotData
