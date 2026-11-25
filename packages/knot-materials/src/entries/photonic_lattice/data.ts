import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'photonic_lattice',
  candidateId: 'gemini_flash',
  title: 'Photonic Lattice',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Coherent laser pulses race through microscopic sapphire waveguides, splitting into sharp diffraction fans upon inspection.',
  placeholder: {
    color: hsl.integer(258, 56, 35),
    shading: 'metal',
  },
} as const satisfies KnotData
