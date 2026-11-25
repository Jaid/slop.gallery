import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7elL7dDIwnRWI8n; fixture: knot-material-shaders; result: crashed, knot rescued from the run container.
export default {
  id: 'aventurine_enamel',
  candidateId: 'gemini_argon',
  title: 'Aventurine Enamel',
  createdAt: 1_792_035_158,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Filigree gold cloisons cradle translucent pools of vitrified glass. Lean in and aventurine copper sparks dance above a sunken silver-leaf guilloché engine.',
  placeholder: {
    color: hsl.integer(125, 5, 36),
    shading: 'glass',
  },
} as const satisfies KnotData
