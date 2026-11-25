import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 9YA8kP6cid9wkS5; fixture: knot-material-shaders.
// Original identity: nacre_shell (Nacre Dream).
export default {
  id: 'nacre_dream',
  candidateId: 'space_bunny',
  title: 'Nacre Dream',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Pearl layers turn with the sea, keeping a little blue in every reflection.',
  placeholder: {
    color: hsl.integer(218, 69, 32),
    shading: 'smooth',
  },
} as const satisfies KnotData
