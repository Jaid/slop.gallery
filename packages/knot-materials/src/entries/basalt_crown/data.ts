import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HdWJtzJ2GnPe32p; fixture: knot-material-shaders; result: success.
export default {
  id: 'basalt_crown',
  candidateId: 'space_bunny',
  title: 'Basalt Crown',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.02,
  flavorText: 'The skin set first and the rock is still arguing underneath it; every plate here is a lid, and the light is underneath.',
  placeholder: {
    color: hsl.integer(34, 10, 23),
    shading: 'stone',
  },
} as const satisfies KnotData
