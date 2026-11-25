import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: DZoyAbZAQlwnlPj; fixture: knot-material-shaders; result: success.
export default {
  id: 'lodestone_tide',
  candidateId: 'claude_opus',
  title: 'Lodestone Tide',
  createdAt: 1_792_085_143,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  displacement: 0.05,
  flavorText: 'A skin of liquid iron lies calm and waits for a magnet. Walk closer and it rises into a crown of black thorns. You are the magnet.',
  placeholder: {
    color: hsl.integer(268, 5, 38),
    shading: 'metal',
  },
} as const satisfies KnotData
