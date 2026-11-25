import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 8sVVxqasPWO5s9R; fixture: knot-material-dot; result: success.
export default {
  id: 'plush_soiree',
  candidateId: 'claude_fable',
  title: 'Plush Soirée',
  createdAt: 1_791_603_706,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'high',
    },
  },
  displacement: 0.1,
  flavorText: 'Seven felted fellows in black bow ties share one endless pink body. Lean in and the wool parts into strands; they blink, glance about and keep their composure.',
  placeholder: {
    color: hsl.integer(348, 73, 70),
    shading: 'fabric',
  },
} as const satisfies KnotData
