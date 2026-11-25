import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4ayQMqfdM3WbrB2; fixture: knot-material-shaders; result: success.
export default {
  id: 'first_frost',
  candidateId: 'claude_fable',
  title: 'First Frost',
  createdAt: 1_792_086_001,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Fable 5.1',
    slug: 'anthropic/claude-fable-5.1',
    effortLevel: 'high',
  }},
  flavorText: 'Night glass, and winter writing on it in ferns. Lean in and your breath fogs the pane; step back and the crystals keep growing.',
  placeholder: {
    color: hsl.integer(258, 3, 42),
    shading: 'stone',
  },
} as const satisfies KnotData
