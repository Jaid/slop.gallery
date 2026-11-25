import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4ayQMqfdM3WbrB2; fixture: knot-material-shaders; result: success.
export default {
  id: 'paper_lantern',
  candidateId: 'claude_fable',
  title: 'Paper Lantern',
  createdAt: 1_792_086_001,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Fable 5.1',
    slug: 'anthropic/claude-fable-5.1',
    effortLevel: 'high',
  }},
  flavorText: 'Mulberry paper over a bamboo frame, and a row of small flames inside that have been burning since the festival ended. Walk around it: the candles move behind the paper.',
  placeholder: {
    color: hsl.integer(67, 27, 62),
    shading: 'fabric',
  },
} as const satisfies KnotData
