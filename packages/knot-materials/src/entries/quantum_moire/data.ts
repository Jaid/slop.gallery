import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quantum_moire',
  candidateId: 'gpt_sol',
  title: 'Quantum Moiré',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'Two almost-identical worlds overlap and reveal a third pattern between them.',
  placeholder: {
    color: hsl.integer(211, 100, 85),
    shading: 'smooth',
  },
} as const satisfies KnotData
