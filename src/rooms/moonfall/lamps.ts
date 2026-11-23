import type {Lamp} from '../base/Room.ts'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import moonfallWallLeds from '#src/lib/gallery/moonfall/fixtures.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import {moonfallSculpture, sculptureLampOffset} from '#src/lib/gallery/moonfall/sculpture.ts'
import staircase, {stairTurn} from '#src/lib/gallery/staircase.ts'

const [sculptureX, sculptureY, sculptureZ] = moonfallSculpture.center
const [lampX, lampY, lampZ] = sculptureLampOffset

export default {
  // Each source sits 60 cm in front of the middle of its housing.
  ...Object.fromEntries(moonfallWallLeds.map(({id, position: [x, y, z], inward: [inwardX, inwardZ]}) => [id, {
    position: [x + inwardX * 0.6, y, z + inwardZ * 0.6],
    tint: moonfallTheme.wallLed,
    strength: 20,
    range: 6,
  } satisfies Lamp])),
  // Glued to the front of the orbital sculpture, `MoonfallOrbit` carries it along as the meteorite turns, so it lights the sawn face and throws the sculpture’s shadow round the room. This is where it sits before the first turn.
  planet_glow: {
    position: [sculptureX + lampX, sculptureY + lampY, sculptureZ + lampZ],
    strength: 99,
    tint: moonfallTheme.planetGlow,
    range: 17,
    decay: 0.75,
    shadow: true,
  },
  ember: {
    position: [6, 2.6, 6.15],
    strength: 13,
    tint: moonfallTheme.ember,
    range: 6,
    decay: 1,
  },
  // In the turn of the stairway up to the Antechamber, where the upper flight comes down into it, 2.72 m over its landing.
  stairs: {
    position: [stairTurn.center[0] + 2.55 - lowerGallery.moonfall.center[0], stairTurn.top + 2.72 - lowerGallery.floorY, staircase.z + 1.52 - lowerGallery.moonfall.center[1]],
    strength: 30,
    tint: moonfallTheme.stairs,
    range: 15,
    decay: 1,
  },
} satisfies Record<string, Lamp>
