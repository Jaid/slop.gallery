import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2E09QDOVGvyWUoU; fixture: knot-material-shaders; result: success.
export default {
  id: 'void_singularity',
  candidateId: 'gemini_argon',
  title: 'Void Singularity',
  createdAt: 1_792_017_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A relativistic accretion disk spirals into a dark event horizon. Orbit the knot and gravitational lensing bends starlight from Doppler blue to redshift crimson.',
  placeholder: {
    color: hsl.integer(276, 7, 48),
    shading: 'smooth',
  },
} as const satisfies KnotData
