import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Cp16WUQoUlMTqRD; fixture: knot-material-shaders; result: success.
export default {
  id: 'murano_breath',
  candidateId: 'muse_wonder',
  title: 'Murano Breath',
  createdAt: 1_791_848_243,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The glassblower’s last breath still turns inside the glass, amber and lagoon, refusing ever to cool.',
  placeholder: {
    color: hsl.integer(107, 14, 55),
    shading: 'glass',
  },
} as const satisfies KnotData
