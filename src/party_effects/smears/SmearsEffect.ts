import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import {knifeSmears, smearCrumbling, smearPoint, smearQuad, smearReach, smearsDone} from './flights.ts'
import playKnifeSlaps from './knifeSlaps.ts'
import SlappedSmears from './SlappedSmears.ts'

/** seconds between the moments `extent` samples */
const extentStep = 0.25

/** An unseen palette knife slaps a burst of thick smears of paint into the air around their origin, ring by ring outward like the petals of a sunflower, each with a wet slap and a struck marimba bar, which drift out into the room as the burst turns, glossy and wet, until the paint sets, cracks and crumbles away. */
export default class SmearsEffect extends PartyEffect {
  readonly duration = smearsDone
  readonly id = 'smears'
  readonly title = 'Knife smears'

  createSprites() {
    return new SlappedSmears(knifeSmears)
  }

  /**
   * Every smear from where it was set down to where the knife lifted off, as wide round it as its quad reaches, past either end by its caps, from the moment it was set down, or `since`, until it has crumbled away.
   * Its moments lie on one grid of {@link extentStep} for every `since`, starting at the last one before it, so what is still to come always lies within where it reaches over its whole show.
   */
  extent(_floor: number, since = 0) {
    return knifeSmears.flatMap(smear => {
      const gone = smear.crumble + smearCrumbling.seconds - smear.delay
      const first = Math.floor(Math.max(0, since - smear.delay) / extentStep)
      const count = Math.ceil(gone / extentStep)
      const times = since > smear.delay + gone ? [] : Array.from({length: count - first + 1}, (_, index) => Math.min(gone, (first + index) * extentStep))
      return times.flatMap(seconds => moments(0, 1, 6).flatMap(share => around(smearPoint(smear, share, seconds), Math.max(smearReach(smear, share, seconds), share % 1 === 0 ? smear.width * smearQuad.caps : 0))))
    })
  }

  sound(audio: AudioOutput, site: PartySite) {
    playKnifeSlaps(audio, site, knifeSmears)
  }
}
