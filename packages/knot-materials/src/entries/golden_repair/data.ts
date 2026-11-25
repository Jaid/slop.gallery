import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IgNMLTcxWnW8Pin; fixture: knot-material-shaders.
export default {
  id: 'golden_repair',
  candidateId: 'claude_opus',
  title: 'Golden Repair',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A celadon vessel crazed with iron wire and gold thread, broken once and mended with gold. Come close: the scars are the warmest part.',
  placeholder: {
    color: hsl.integer(154, 46, 55),
    shading: 'smooth',
  },
} as const satisfies KnotData
