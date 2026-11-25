import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: D2pmfQp7iycRJKh; fixture: knot-material-shaders; result: success.
export default {
  id: 'empress_brocade',
  candidateId: 'muse_wonder',
  title: 'Empress Brocade',
  createdAt: 1_791_886_417,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Plum silk remembers every angle of the court: gold damask hides from a direct gaze and blazes caught in passing.',
  placeholder: {
    color: hsl.integer(334, 50, 22),
    shading: 'fabric',
  },
} as const satisfies KnotData
