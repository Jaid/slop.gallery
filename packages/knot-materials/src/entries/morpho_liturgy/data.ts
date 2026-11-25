import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: GsOIgdKyNa5oEPr; fixture: knot-material-shaders; result: success.
export default {
  id: 'morpho_liturgy',
  candidateId: 'muse_wonder',
  title: 'Morpho Liturgy',
  createdAt: 1_791_879_378,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'high',
    },
  },
  flavorText: 'A thousand butterfly scales drink the light and answer in blue only when you stand where the sun intended.',
  placeholder: {
    color: hsl.integer(257, 89, 40),
    shading: 'glass',
  },
} as const satisfies KnotData
