import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'ghost_mycelium',
  candidateId: 'gemini_flash',
  title: 'Ghost Mycelium',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Subterranean threads breathe in the velvet dark, whispering in pulses of cold emerald foxfire as you draw near.',
  placeholder: {
    color: hsl.integer(151, 66, 61),
    shading: 'glass',
  },
} as const satisfies KnotData
