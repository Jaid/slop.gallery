import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: K0nU326lufLQTl2; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'abyssal_medusa',
  candidateId: 'space_bunny',
  title: 'Abyssal Medusa',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Four kilometres down, in water that has never seen the sun, something still keeps time - and lights up when you pass.',
  placeholder: {
    color: hsl.integer(287, 69, 10),
    shading: 'glass',
  },
} as const satisfies KnotData
