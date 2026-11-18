import type {Lamp} from '../base/Room.ts'

import moonfallWallLeds from '#src/lib/gallery/moonfall/fixtures.ts'

export default {
  // Each source sits 60 cm in front of the middle of its housing.
  ...Object.fromEntries(moonfallWallLeds.map(({id, position: [x, y, z], inward: [inwardX, inwardZ]}) => [id, {
    position: [x + inwardX * 0.6, y, z + inwardZ * 0.6],
    tint: '#91c9c4',
    strength: 15,
    range: 10,
  } satisfies Lamp])),
  spotlight: {
    kind: 'spot',
    position: [-7, 3.3, -4],
    target: [0, -1.5, 0],
    angle: 0.9,
    penumbra: 0.28,
    strength: 860,
    tint: '#e0d0b2',
    range: 15,
    shadow: true,
  },
  // The planet’s glow, rising from the crater, throws the orbital sculpture’s shadow onto the ceiling.
  planet_glow: {
    position: [5.37, 1.02, -0.19],
    strength: 216,
    tint: '#64bfb5',
    range: 20,
    decay: 1.25,
    shadow: true,
  },
  ember: {
    position: [6, 2.6, 6.15],
    strength: 27,
    tint: '#af7e5f',
    range: 15,
    decay: 1,
  },
  // Over the upper flight of the stairway up to the Antechamber.
  stairs: {
    position: [24.55, 6.72, -4.98],
    strength: 30,
    tint: '#8ad6cd',
    range: 15,
    decay: 1,
  },
} satisfies Record<string, Lamp>
