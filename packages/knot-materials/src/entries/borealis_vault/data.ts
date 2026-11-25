import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: DZoyAbZAQlwnlPj; fixture: knot-material-shaders; result: success.
export default {
  id: 'borealis_vault',
  candidateId: 'claude_opus',
  title: 'Borealis Vault',
  createdAt: 1_792_085_143,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'A polar night sealed in black ice. Green curtains fold and ripple through it, blushing crimson at their crowns, and turn to watch you as you circle.',
  placeholder: {
    color: hsl.integer(170, 11, 39),
    shading: 'glass',
  },
} as const satisfies KnotData
