import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KKRUCJSg0WdighD; fixture: knot-material-shaders.
export default {
  id: 'abyssal_pulse',
  candidateId: 'claude_fable',
  title: 'Abyssal Pulse',
  createdAt: 1_790_695_541,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'high',
    },
  },
  displacement: 0.02,
  flavorText: 'Something from below the reach of sunlight, breathing in the dark. It notices you: rings of cold light run away from wherever you stand, and its skin blushes as you come near.',
  placeholder: {
    color: hsl.integer(297, 65, 9),
    shading: 'glass',
  },
} as const satisfies KnotData
