import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4ayQMqfdM3WbrB2; fixture: knot-material-shaders; result: success.
export default {
  id: 'kintsugi',
  candidateId: 'claude_fable',
  title: 'Kintsugi',
  createdAt: 1_792_086_001,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Fable 5.1',
    slug: 'anthropic/claude-fable-5.1',
    effortLevel: 'high',
  }},
  flavorText: 'It was dropped once and mended with gold, the way the old masters did – not to hide the break but to honor it. The gold is still warm, and it still moves.',
  placeholder: {
    color: hsl.integer(145, 9, 45),
    shading: 'stone',
  },
} as const satisfies KnotData
