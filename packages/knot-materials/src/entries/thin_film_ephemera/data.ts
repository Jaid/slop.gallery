import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7V0v37e8AD5LVut; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'thin_film_ephemera',
  candidateId: 'space_bunny',
  title: 'Thin-Film Ephemera',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A film two hundred nanometres thick, holding a whole sunset together until the smallest breath ends it.',
  placeholder: {
    color: hsl.integer(228, 56, 78),
    shading: 'glass',
  },
} as const satisfies KnotData
