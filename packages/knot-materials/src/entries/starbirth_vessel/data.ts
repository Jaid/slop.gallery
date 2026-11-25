import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: BdUi8mU2Rs29CX7; fixture: knot-material-shaders.
export default {
  id: 'starbirth_vessel',
  candidateId: 'claude_opus',
  title: 'Starbirth Vessel',
  createdAt: 1_791_585_164,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A glassblower caught a stellar nursery in a single breath. Inside, pillars of dust still shelter newborn suns, and the gas glows as though it remembers the sky.',
  placeholder: {
    color: hsl.integer(264, 73, 22),
    shading: 'glass',
  },
} as const satisfies KnotData
