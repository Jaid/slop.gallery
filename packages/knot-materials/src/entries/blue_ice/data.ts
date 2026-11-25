import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MDsU2CH3XEff3jd; fixture: knot-material-shaders; result: success.
export default {
  id: 'blue_ice',
  candidateId: 'space_bunny',
  title: 'Blue Ice',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.004,
  flavorText: 'Nine hundred years of snow, compressed until the air itself was forced into the glass and stayed there.',
  placeholder: {
    color: hsl.integer(244, 61, 35),
    shading: 'glass',
  },
} as const satisfies KnotData
