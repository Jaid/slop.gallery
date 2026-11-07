import type {AudioOutput} from '#src/lib/audio/proceduralAudio.ts'
import type {PortalFrame} from '#src/lib/gallery/fusion/portalFrame.ts'

import playBloodGush from '#src/lib/audio/bloodGush.ts'

import EmergenceEffect from '../base/EmergenceEffect.ts'
import BloodSpray from './BloodSpray.ts'
import {bloodBeats, bloodDrops, bloodFading, bloodPool, bloodSplats} from './flights.ts'

/** The portal bleeds like a cut artery as the result of a successful fusion flips out: jets on three beats of a racing heart break up into drops large and fine and a mist, which the air slows down, and leave stains by the angle they struck at, which dry dark and dull before they fade, around a pool gathering under the portal that is sucked back into it at last. */
export default class BloodEffect extends EmergenceEffect {
  override readonly afterglow = Math.max(bloodFading.start + bloodFading.stagger + bloodFading.duration, bloodPool.draining.start + bloodPool.draining.seconds)
  readonly id = 'horror-blood'

  createSprites() {
    return new BloodSpray(bloodDrops)
  }

  sound(audio: AudioOutput, frame: PortalFrame) {
    playBloodGush(audio, frame, {
      beats: bloodBeats,
      splats: bloodSplats(bloodDrops, frame.floor - frame.center[1]),
    })
  }
}
