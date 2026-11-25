import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KKRUCJSg0WdighD; fixture: knot-material-shaders.
export default {
  id: 'glacial_heart',
  candidateId: 'claude_fable',
  title: 'Glacial Heart',
  createdAt: 1_790_695_541,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'high',
    },
  },
  flavorText: 'Ten thousand winters pressed into blue glass. Air that last touched the sky before any city was built still waits in its bubbles, and something warm keeps time deep inside.',
  placeholder: {
    color: hsl.integer(241, 54, 84.6),
    shading: 'glass',
  },
} as const satisfies KnotData
