import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Am1BnNRHvHbHCa2; fixture: knot-material-shaders; result: success.
export default {
  id: 'glacier_testament',
  candidateId: 'muse_wonder',
  title: 'Glacier Testament',
  createdAt: 1_791_867_537,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.01,
  flavorText: 'Ancient snow remembers every winter as a bright fracture sealed in blue glass — lean close and listen for the trapped bubbles.',
  placeholder: {
    color: hsl.integer(242, 43, 71),
    shading: 'glass',
  },
} as const satisfies KnotData
