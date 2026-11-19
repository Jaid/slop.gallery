import type {Lamp} from '../base/Room.ts'

import forge, {forgeBenchLamps, forgeVestibule} from '#src/lib/gallery/forge.ts'
import {forgeCupola} from '#src/lib/gallery/forgeRoof.ts'

const {y, throwFromWall, z, sites} = forgeBenchLamps

export default {
  ...Object.fromEntries(Object.entries(sites).map(([id, x]) => [id, {
    kind: 'spot',
    position: [x, y - 0.075, z - throwFromWall],
    target: [x * 0.7, 0.9, z - 1],
    angle: 0.87,
    penumbra: 0.74,
    tint: '#ffe2bd',
    strength: 19,
    range: 5.5,
    decay: 1.55,
  } satisfies Lamp])),
  cupola: {
    position: [0, forgeCupola.lampY, forgeVestibule.center[1] - forge.center[1]],
    tint: '#ffdbad',
    strength: 31,
    range: 8.5,
    shadow: 'heavy',
    decay: 1.75,
  },
} satisfies Record<string, Lamp>
