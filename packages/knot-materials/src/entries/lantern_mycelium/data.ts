import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7V0v37e8AD5LVut; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'lantern_mycelium',
  candidateId: 'space_bunny',
  title: 'Lantern Mycelium',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.02,
  flavorText: 'Under the bark of a fallen century, something patient has been building lanterns out of patience and water.',
  placeholder: {
    color: hsl.integer(59, 29, 10),
    shading: 'smooth',
  },
} as const satisfies KnotData
