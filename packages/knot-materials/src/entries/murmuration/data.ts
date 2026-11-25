import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4eznRMVv3vZMHhr; fixture: knot-material-shaders; result: success.
export default {
  id: 'murmuration',
  candidateId: 'claude_opus',
  title: 'Murmuration',
  createdAt: 1_792_086_173,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'Ten thousand starlings ride the evening gold along the knot. Draw near and the flock startles open around you, then quietly closes behind.',
  placeholder: {
    color: hsl.integer(9, 19, 31),
    shading: 'smooth',
  },
} as const satisfies KnotData
