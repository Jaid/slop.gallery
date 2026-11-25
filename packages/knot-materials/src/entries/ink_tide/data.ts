import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HdWJtzJ2GnPe32p; fixture: knot-material-shaders; result: success.
export default {
  id: 'ink_tide',
  candidateId: 'space_bunny',
  title: 'Ink Tide',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Ink was floated on water ring by ring, lifted on paper in a single breath, and has been holding that breath ever since.',
  placeholder: {
    color: hsl.integer(86, 33, 88),
    shading: 'smooth',
  },
} as const satisfies KnotData
