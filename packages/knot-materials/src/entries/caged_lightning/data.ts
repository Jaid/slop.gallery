import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4ayQMqfdM3WbrB2; fixture: knot-material-shaders; result: success.
export default {
  id: 'caged_lightning',
  candidateId: 'claude_fable',
  title: 'Caged Lightning',
  createdAt: 1_792_086_001,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Fable 5.1',
    slug: 'anthropic/claude-fable-5.1',
    effortLevel: 'high',
  }},
  flavorText: 'A storm was sealed in glass before it could finish. It still remembers hands: come close and the lightning leans toward you.',
  placeholder: {
    color: hsl.integer(292, 38, 45),
    shading: 'glass',
  },
} as const satisfies KnotData
