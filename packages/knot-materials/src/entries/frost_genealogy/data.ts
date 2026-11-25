import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7V0v37e8AD5LVut; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'frost_genealogy',
  candidateId: 'space_bunny',
  title: 'Frost Genealogy',
  createdAt: 1_790_458_629,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.005,
  flavorText: 'Every crystal is a letter from a colder alphabet, written one generation at a time on a pane that forgot the sun.',
  placeholder: {
    color: hsl.integer(249, 36, 77),
    shading: 'glass',
  },
} as const satisfies KnotData
