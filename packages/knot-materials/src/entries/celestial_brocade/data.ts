import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5WDU20J87Ktg4fx; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'celestial_brocade',
  candidateId: 'claude_sonnet',
  title: 'Celestial Brocade',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Someone stitched the night sky into velvet by candlelight, one gold thread per star. Walk around it and the whole cloth breathes light.',
  placeholder: {
    color: hsl.integer(280, 81, 14),
    shading: 'fabric',
  },
} as const satisfies KnotData
