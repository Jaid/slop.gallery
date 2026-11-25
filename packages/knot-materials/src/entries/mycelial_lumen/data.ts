import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BJsZFlj5mQPSiFo; fixture: knot-material-shaders.
export default {
  id: 'mycelial_lumen',
  candidateId: 'space_bunny',
  title: 'Mycelial Lumen',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A forest floor translated into light: roots wander beneath a skin of midnight glass.',
  placeholder: {
    color: hsl.integer(195, 85, 29),
    shading: 'glass',
  },
  displacement: 0.00012,
} as const satisfies KnotData
