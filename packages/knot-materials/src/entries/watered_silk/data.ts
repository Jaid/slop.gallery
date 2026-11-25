import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4eznRMVv3vZMHhr; fixture: knot-material-shaders; result: success.
export default {
  id: 'watered_silk',
  candidateId: 'claude_opus',
  title: 'Watered Silk',
  createdAt: 1_792_086_173,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'Two veils of silk, one just above the other. Neither holds a pattern of its own, yet between them tides of light ebb and flow with every step you take.',
  placeholder: {
    color: hsl.integer(107, 10, 50),
    shading: 'fabric',
  },
} as const satisfies KnotData
