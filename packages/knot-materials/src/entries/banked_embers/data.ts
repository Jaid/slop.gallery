import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4eznRMVv3vZMHhr; fixture: knot-material-shaders; result: success.
export default {
  id: 'banked_embers',
  candidateId: 'claude_opus',
  title: 'Banked Embers',
  createdAt: 1_792_086_173,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'Charcoal that remembers the fire. It sleeps beneath its own ash, but lean in close and it wakes, breathing heat back at you.',
  placeholder: {
    color: hsl.integer(38, 26, 22),
    shading: 'stone',
  },
} as const satisfies KnotData
