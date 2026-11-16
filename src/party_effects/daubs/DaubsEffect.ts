import type {PartyOffset, PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import {daubOffset, daubsDone, impastoDaubs} from './flights.ts'
import ImpastoDaubs from './ImpastoDaubs.ts'
import playKnifeFlourish from './knifeFlourish.ts'

/** Unseen palette knives fling thick slabs of unmixed oil paint out around the origin, turning slightly as they float forward before crusting and flaking away. */
export default class DaubsEffect extends PartyEffect {
  readonly duration = daubsDone
  readonly id = 'daubs'
  readonly title = 'Impasto daubs'

  createSprites() {
    return new ImpastoDaubs(impastoDaubs)
  }

  /** Every daub’s reach from bursting out, or `since`, until it has flaked away, never below `floor`. */
  extent(floor: number, since = 0): Array<PartyOffset> {
    return impastoDaubs.flatMap(daub => {
      const radius = Math.max(...daub.size) / 2
      return moments(Math.max(0, since - daub.delay), daub.life * 0.9, 5).flatMap(seconds => around(daubOffset(daub, seconds), radius).map(([along, up, out]): PartyOffset => [along, Math.max(floor, up), out]))
    })
  }

  sound(audio: AudioOutput, site: PartySite) {
    playKnifeFlourish(audio, site, impastoDaubs)
  }
}
