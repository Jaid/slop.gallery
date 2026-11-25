import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KKRUCJSg0WdighD; fixture: knot-material-shaders.
export default {
  id: 'thousand_folds',
  candidateId: 'claude_fable',
  title: 'Thousand Folds',
  createdAt: 1_790_695_541,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'high',
    },
  },
  flavorText: 'Fold, weld, fold again. The smith never counts, yet every layer remembers its turn at the hammer. Acid revealed the story, fire wrote the colors, the edge recalls being warm.',
  placeholder: {
    color: hsl.integer(256, 8, 41),
    shading: 'metal',
  },
} as const satisfies KnotData
