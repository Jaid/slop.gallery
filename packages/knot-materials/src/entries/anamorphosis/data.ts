import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MgSdUInR50wESrr; fixture: knot-material-shaders; result: success.
export default {
  id: 'anamorphosis',
  candidateId: 'muse_wonder',
  title: 'Anamorphosis',
  createdAt: 1_791_858_712,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Two pictures share one ribbed skin. Walk, and silver moons dissolve into an ember lattice; stand still, and neither will confess.',
  placeholder: {
    color: hsl.integer(219, 14, 70),
    shading: 'metal',
  },
} as const satisfies KnotData
