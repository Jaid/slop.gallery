import type {Lamp} from '../base/Room.ts'

import moonfallWallLeds from '#src/lib/gallery/moonfall/fixtures.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import {moonfallSculpture, sculptureLampOffset} from '#src/lib/gallery/moonfall/sculpture.ts'

const [sculptureX, sculptureY, sculptureZ] = moonfallSculpture.center
const [lampX, lampY, lampZ] = sculptureLampOffset

export default {
  // Each source sits 60 cm in front of the middle of its housing.
  ...Object.fromEntries(moonfallWallLeds.map(({id, position: [x, y, z], inward: [inwardX, inwardZ]}) => [id, {
    position: [x + inwardX * 0.6, y, z + inwardZ * 0.6],
    tint: moonfallTheme.wallLed,
    strength: 15,
    range: 10,
  } satisfies Lamp])),
  // Glued to the front of the orbital sculpture, `MoonfallOrbit` carries it along as the meteorite turns, so it lights the sawn face and throws the sculpture’s shadow round the room. This is where it sits before the first turn.
  planet_glow: {
    position: [sculptureX + lampX, sculptureY + lampY, sculptureZ + lampZ],
    strength: 216,
    tint: moonfallTheme.planetGlow,
    range: 20,
    decay: 1.25,
    shadow: true,
  },
  ember: {
    position: [6, 2.6, 6.15],
    strength: 27,
    tint: moonfallTheme.ember,
    range: 15,
    decay: 1,
  },
  // Over the upper flight of the stairway up to the Antechamber.
  stairs: {
    position: [24.55, 6.72, -4.98],
    strength: 30,
    tint: moonfallTheme.stairs,
    range: 15,
    decay: 1,
  },
} satisfies Record<string, Lamp>
