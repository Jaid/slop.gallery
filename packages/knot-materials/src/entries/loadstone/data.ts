import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MDsU2CH3XEff3jd; fixture: knot-material-shaders; result: success.
export default {
  id: 'loadstone',
  candidateId: 'space_bunny',
  title: 'Loadstone',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.06,
  flavorText: 'The old magnet remembers being a mountain of iron; set it free, and it stands up in points to greet the field.',
  placeholder: {
    color: hsl.integer(276, 24, 10),
    shading: 'liquid',
  },
} as const satisfies KnotData
