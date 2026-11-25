import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BJsZFlj5mQPSiFo; fixture: knot-material-shaders.
export default {
  id: 'moonstone_dune',
  candidateId: 'space_bunny',
  title: 'Moonstone Dune',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Fine lunar dust drifts over a warm stone, catching blue fire between one breath and the next.',
  placeholder: {
    color: hsl.integer(83, 35, 79),
    shading: 'stone',
  },
  displacement: 0.00011,
} as const satisfies KnotData
