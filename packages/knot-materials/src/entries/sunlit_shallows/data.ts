import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4eznRMVv3vZMHhr; fixture: knot-material-shaders; result: success.
export default {
  id: 'sunlit_shallows',
  candidateId: 'claude_opus',
  title: 'Sunlit Shallows',
  createdAt: 1_792_086_173,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'A hand’s depth of clear water over rippled sand, and noon light braiding itself into gold on the bottom. Kneel, and the surface turns from window to mirror.',
  placeholder: {
    color: hsl.integer(133, 12, 53),
    shading: 'liquid',
  },
} as const satisfies KnotData
