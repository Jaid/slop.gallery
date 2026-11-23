import type {Lamp} from '../base/Room.ts'

import antechamber, {antechamberEastLanding} from '#src/lib/gallery/antechamber.ts'

const [originX, originZ] = antechamber.center
const [landingX, landingZ] = antechamberEastLanding.center

export default {
  // Soft warm glow suspended well off the walls over the upper east stairs, illuminating the ascent and end wall evenly without specular glare.
  east_stairs: {
    position: [landingX - originX - 1.5, antechamberEastLanding.floorY + 2.6, landingZ - originZ],
    tint: '#ffe6be',
    strength: 4.5,
    range: 12,
    decay: 1.5,
  },
} satisfies Record<string, Lamp>
