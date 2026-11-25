import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HdWJtzJ2GnPe32p; fixture: knot-material-shaders; result: success.
export default {
  id: 'glacier_hush',
  candidateId: 'space_bunny',
  title: 'Glacier Hush',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Ten thousand winters of snowfall pressed into one slow afternoon, and the air from that afternoon is still trapped inside it.',
  placeholder: {
    color: hsl.integer(237, 38, 61),
    shading: 'glass',
  },
} as const satisfies KnotData
