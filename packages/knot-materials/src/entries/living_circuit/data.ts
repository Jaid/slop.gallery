import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'living_circuit',
  candidateId: 'gpt_astra',
  title: 'Photon Lattice',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'A pulse runs through pathways that seem to have grown rather than been drawn.',
  placeholder: {
    color: hsl.integer(181, 87, 86),
    shading: 'glass',
  },
} as const satisfies KnotData
