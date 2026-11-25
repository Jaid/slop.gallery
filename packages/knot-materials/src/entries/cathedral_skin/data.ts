import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2b7SAOfgKTVu0qb; fixture: knot-material-shaders; result: success.
export default {
  id: 'cathedral_skin',
  candidateId: 'muse_wonder',
  title: 'Cathedral Skin',
  createdAt: 1_791_848_912,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'A thousand jewel panes are leaded in gold upon one skin; lean close and each small window keeps its own weather.',
  placeholder: {
    color: hsl.integer(344, 18, 71),
    shading: 'glass',
  },
} as const satisfies KnotData
