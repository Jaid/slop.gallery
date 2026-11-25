import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: HdWJtzJ2GnPe32p; fixture: knot-material-shaders; result: success.
export default {
  id: 'ferro_tide',
  candidateId: 'space_bunny',
  title: 'Ferro Tide',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.12,
  flavorText: 'Iron that has forgotten it was ever a solid. It stands up toward whoever is nearest and lies back down the moment they leave.',
  placeholder: {
    color: hsl.integer(264, 24, 12),
    shading: 'liquid',
  },
} as const satisfies KnotData
