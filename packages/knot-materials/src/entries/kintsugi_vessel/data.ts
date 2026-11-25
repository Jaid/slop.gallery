import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CbMOkykhfBD7NuC; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'kintsugi_vessel',
  candidateId: 'claude_haiku',
  title: 'Kintsugi Vessel',
  createdAt: 1_791_758_163,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A celadon bowl broke, and was mended with gold lacquer. Every seam now burns brighter than the glaze that was lost.',
  placeholder: {
    color: hsl.integer(135, 22, 72),
    shading: 'glass',
  },
} as const satisfies KnotData
