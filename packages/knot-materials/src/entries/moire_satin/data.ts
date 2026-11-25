import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BJsZFlj5mQPSiFo; fixture: knot-material-shaders.
export default {
  id: 'moire_satin',
  candidateId: 'space_bunny',
  title: 'Moiré Satin',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A midnight weave remembers every angle of the hand that crossed it; its colors arrive only when you move.',
  placeholder: {
    color: hsl.integer(293, 73, 37),
    shading: 'fabric',
  },
  displacement: 0.00009,
} as const satisfies KnotData
