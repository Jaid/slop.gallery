import type {PortalFrame} from '#src/lib/gallery/fusion/portalFrame.ts'
import type {AudioOutput} from 'procedural-audio'

import playBloodGush from '#src/lib/audio/bloodGush.ts'

import EmergenceEffect from '../base/EmergenceEffect.ts'
import BloodSpray from './BloodSpray.ts'
import {bloodBeats, bloodDrops, bloodExtent, bloodFading, bloodPool, bloodPouring, bloodSplats} from './flights.ts'

/** The portal bleeds like a cut artery as the result of a successful fusion flips out: jets on three beats of a racing heart break up into drops large and fine and a mist, which the air slows down, and leave stains by the angle they struck at, which dry dark and dull before they fade, around a pool that a stream pouring straight down out of the portal fills under it and that is sucked back into it at last. */
export default class BloodEffect extends EmergenceEffect {
  override readonly afterglow = Math.max(bloodFading.start + bloodFading.stagger + bloodFading.duration, bloodPool.draining.start + bloodPool.draining.seconds)
  readonly id = 'horror-blood'

  createSprites() {
    return new BloodSpray(bloodDrops)
  }

  extent(floor: number, since = 0) {
    return bloodExtent(bloodDrops, floor, since)
  }

  sound(audio: AudioOutput, frame: PortalFrame) {
    const floor = frame.floor - frame.center[1]
    playBloodGush(audio, frame, {
      beats: bloodBeats,
      pouring: bloodPouring(floor),
      splats: bloodSplats(bloodDrops, floor),
    })
  }
}
