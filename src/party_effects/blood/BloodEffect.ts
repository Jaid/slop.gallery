import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import playBloodGush from './bloodGush.ts'
import BloodSpray from './BloodSpray.ts'
import {bloodBeats, bloodDrops, bloodExtent, bloodFading, bloodPool, bloodPouring, bloodSplats} from './flights.ts'

/** Its origin bleeds like a cut artery: jets on three beats of a racing heart break up into drops large and fine and a mist, which the air slows down, and leave stains by the angle they struck at, which dry dark and dull before they fade, around a pool that a stream pouring straight down out of the origin fills under it and that is sucked back into it at last. */
export default class BloodEffect extends PartyEffect {
  readonly duration = Math.max(bloodFading.start + bloodFading.stagger + bloodFading.duration, bloodPool.draining.start + bloodPool.draining.seconds)
  readonly id = 'blood'
  readonly title = 'Blood'

  createSprites() {
    return new BloodSpray(bloodDrops)
  }

  extent(floor: number, since = 0) {
    return bloodExtent(bloodDrops, floor, since)
  }

  sound(audio: AudioOutput, site: PartySite) {
    const floor = site.floor - site.center[1]
    playBloodGush(audio, site, {
      beats: bloodBeats,
      pouring: bloodPouring(floor),
      splats: bloodSplats(bloodDrops, floor),
    })
  }
}
