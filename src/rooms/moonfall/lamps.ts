import type {Lamp} from '../base/Room.ts'

import roomOrigins from '#src/lib/gallery/layout.ts'
import moonfallWallLeds from '#src/lib/gallery/moonfall/fixtures.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import {moonfallSculpture, sculptureLampOffset} from '#src/lib/gallery/moonfall/sculpture.ts'
import {stairTurn} from '#src/lib/gallery/staircase.ts'

const [sculptureX, sculptureY, sculptureZ] = moonfallSculpture.center
const [lampX, lampY, lampZ] = sculptureLampOffset
const [originX, originY, originZ] = roomOrigins.moonfall
const [turnX, turnY, turnZ] = stairTurn.position

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
  // Over the landing that turns the stairway up to the Antechamber’s gallery, at its apex, from where it reaches down both flights.
  stairs: {
    position: [turnX - originX, turnY + 2.72 - originY, turnZ - originZ],
    strength: 30,
    tint: moonfallTheme.stairs,
    range: 15,
    decay: 1,
  },
} satisfies Record<string, Lamp>
