import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quantum_circuit',
  candidateId: 'kimi',
  title: 'Quantum Circuit',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'A tiny network follows several bright possibilities before choosing a path.',
  placeholder: {
    color: hsl.integer(89, 100, 87.4),
    shading: 'smooth',
  },
} as const satisfies KnotData
