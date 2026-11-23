import type {Lamp} from '../base/Room.ts'

import lowerGallery from '#src/lib/gallery/lowerGallery.ts'
import moonfallWallLeds from '#src/lib/gallery/moonfall/fixtures.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import {moonfallSculpture, sculptureLampOffset} from '#src/lib/gallery/moonfall/sculpture.ts'
import {approachBendPoint, stairApproach, stairTurn} from '#src/lib/gallery/staircase.ts'

const [sculptureX, sculptureY, sculptureZ] = moonfallSculpture.center
const [lampX, lampY, lampZ] = sculptureLampOffset
const [originX, originZ] = lowerGallery.moonfall.center
const [bendX, bendZ] = approachBendPoint(Math.PI / 4)

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
  // Along the curved ground-level approach leaving the Antechamber’s west pavilion.
  approach_bend: {
    position: [bendX - originX, stairApproach.y - lowerGallery.floorY + 3.1, bendZ - originZ],
    strength: 24,
    tint: moonfallTheme.stairs,
    range: 16,
    decay: 1,
  },
  // Approaching the head of the upper descending flight.
  approach_east: {
    position: [3 - originX, stairApproach.y - lowerGallery.floorY + 3.1, stairApproach.eastRun.z - originZ],
    strength: 22,
    tint: moonfallTheme.stairs,
    range: 15,
    decay: 1,
  },
  // Over the U-turn landing and both descending flights east of Moonfall’s east wall.
  stairs: {
    position: [stairTurn.center[0] + 1.5 - originX, stairTurn.top - lowerGallery.floorY + 3, stairTurn.center[1] - originZ],
    strength: 36,
    tint: moonfallTheme.stairs,
    range: 18,
    decay: 1,
  },
} satisfies Record<string, Lamp>
