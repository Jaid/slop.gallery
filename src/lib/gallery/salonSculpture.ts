import type {SculptureId} from '#src/sculptures/index.ts'
import type {Vec3} from 'math'

import {createSculpture, sculptures} from '#src/sculptures/index.ts'
import {forcedSculpture} from '#src/sculptures/lib/forcedSculpture.ts'

import {environmentRandom, isDefaultSeed} from '../environmentSeed.ts'
import {environmentSeed} from '../gameSeed.ts'
import {salonSculptureSocket} from './salon.ts'

const sculptureIds = Object.keys(sculptures) as Array<SculptureId>

export function salonSculptureId(seed: number, forced: SculptureId | '' = forcedSculpture): SculptureId {
  if (forced) {
    return forced
  }
  if (isDefaultSeed(seed)) {
    return sculptureIds[0]
  }
  return environmentRandom(seed).makeChild(['salon', 'sculpture']).rollItem(sculptureIds)
}

export const salonSculpture = createSculpture(salonSculptureId(environmentSeed))

const {position: [x, y, z], size: [, height]} = salonSculptureSocket
/** The center of the socket’s top, where the sculpture’s foot rests. */
export const salonSculptureSpot: Vec3 = [x, y + height, z]
