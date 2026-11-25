import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7V0v37e8AD5LVut; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'tesserae',
  candidateId: 'space_bunny',
  title: 'Tesserae',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.01,
  flavorText: 'A thousand years of patience, cut into glass and laid in gold; the icon only faces the worshipper.',
  placeholder: {
    color: hsl.integer(264, 89, 31.5),
    shading: 'glass',
  },
} as const satisfies KnotData
