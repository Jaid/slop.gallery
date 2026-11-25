import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KKRUCJSg0WdighD; fixture: knot-material-shaders.
export default {
  id: 'pocket_nebula',
  candidateId: 'claude_fable',
  title: 'Pocket Nebula',
  createdAt: 1_790_695_541,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'high',
    },
  },
  flavorText: 'Someone folded a night sky into a loop of black glass. Lean closer and the stars drift apart; step back and they close ranks again, keeping their distances like real ones do.',
  placeholder: {
    color: hsl.integer(285, 69, 8),
    shading: 'glass',
  },
} as const satisfies KnotData
