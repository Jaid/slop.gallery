import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7elL7dDIwnRWI8n; fixture: knot-material-shaders; result: crashed, knot rescued from the run container.
export default {
  id: 'seraph_wings',
  candidateId: 'gemini_argon',
  title: 'Seraph Wings',
  createdAt: 1_792_035_158,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Six-winged plumage of metallic azure barbules and golden filigree quills. Walk around the knot and structural diffraction sweeps from sapphire to ultraviolet.',
  placeholder: {
    color: hsl.integer(248, 40, 35),
    shading: 'metal',
  },
} as const satisfies KnotData
