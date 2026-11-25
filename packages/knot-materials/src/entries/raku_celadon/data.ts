import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2E09QDOVGvyWUoU; fixture: knot-material-shaders; result: success.
export default {
  id: 'raku_celadon',
  candidateId: 'gemini_argon',
  title: 'Raku Celadon',
  createdAt: 1_792_017_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.011,
  flavorText: 'Thick jade celadon pools over charred stoneware, crazed with golden kintsugi seams. As you walk past, kiln iridescence blooms along the cracks.',
  placeholder: {
    color: hsl.integer(161, 13, 52),
    shading: 'smooth',
  },
} as const satisfies KnotData
