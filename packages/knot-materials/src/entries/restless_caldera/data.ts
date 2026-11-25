import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5RXWnszENQQH6u3; fixture: knot-material-shaders; result: success.
export default {
  id: 'restless_caldera',
  candidateId: 'space_bunny',
  title: 'Restless Caldera',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.03,
  flavorText: 'A skin of black glass, cooled until it could hold. Underneath, the mountain never once agreed to stop.',
  placeholder: {
    color: hsl.integer(316, 25, 6),
    shading: 'stone',
  },
} as const satisfies KnotData
