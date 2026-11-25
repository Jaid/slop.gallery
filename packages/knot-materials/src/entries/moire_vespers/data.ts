import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7V0v37e8AD5LVut; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'moire_vespers',
  candidateId: 'space_bunny',
  title: 'Moiré Vespers',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Two engravings so nearly alike that neither can be seen; only the silence between them makes a picture.',
  placeholder: {
    color: hsl.integer(293, 84, 48),
    shading: 'metal',
  },
} as const satisfies KnotData
