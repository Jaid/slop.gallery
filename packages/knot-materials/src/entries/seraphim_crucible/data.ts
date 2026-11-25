import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5hImMIyOl2S4OQR; fixture: knot-material-shaders; result: crashed, knot rescued from the run container.
export default {
  id: 'seraphim_crucible',
  candidateId: 'gemini_argon',
  title: 'Seraphim Crucible',
  createdAt: 1_792_035_158,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'high',
    },
  },
  displacement: 0.022,
  flavorText: 'Six golden rings of a dead sun orbit a core of burning plasma; walk closer and the ancient brass parts its wings to let the solar choir sing.',
  placeholder: {
    color: hsl.integer(63, 28, 48),
    shading: 'metal',
  },
} as const satisfies KnotData
