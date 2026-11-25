import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: K0nU326lufLQTl2; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'chladni_requiem',
  candidateId: 'space_bunny',
  title: 'Chladni Requiem',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A plate of ancient bronze, struck once: the sand rises, runs, and settles into the only shape the note allows.',
  placeholder: {
    color: hsl.integer(69, 73, 44),
    shading: 'metal',
  },
} as const satisfies KnotData
