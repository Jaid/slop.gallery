import type {PartyOffset, PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around} from '../lib/partySite.ts'
import playFleshGroan from './fleshGroan.ts'
import {lashing, lashingTendrils, snapping, tendrilReach} from './flights.ts'
import WrithingTendrils from './WrithingTendrils.ts'

/** how far a tendril overshoots its length as it lashes out, a share of it, as `WrithingTendrils` eases it out */
const overshoot = 0.1

/** Fleshy tendrils lash out of their origin as it bursts, writhe and grope about under a deep groan and snap back into it one after another. */
export default class TendrilsEffect extends PartyEffect {
  readonly duration = Math.max(...lashingTendrils.map(({retract}) => retract)) + snapping
  readonly id = 'tendrils'
  readonly title = 'Flesh tendrils'

  createSprites() {
    return new WrithingTendrils(lashingTendrils)
  }

  /** Every tendril from its root in the origin to its tip, as far as it overshoots while it lashes out and where it settles, with room for its hook and its writhing, but none below the floor, from lashing out, or `since`, until it has snapped back. */
  extent(floor: number, since = 0) {
    const root: PartyOffset = [0, 0, 0]
    return lashingTendrils.filter(tendril => since < tendril.retract + snapping).flatMap(tendril => {
      const [along, up, out] = tendrilReach(tendril)
      const stretches = since < tendril.delay + lashing ? [1, 1 + overshoot] : [1]
      return [root, ...stretches.flatMap(stretch => {
        const tip: PartyOffset = [along * stretch, up * stretch, out * stretch]
        const middle: PartyOffset = [tip[0] / 2, tip[1] / 2, tip[2] / 2]
        const sway = tendril.length * stretch * (Math.abs(tendril.curl) + 0.1)
        return [...around(middle, sway / 2), ...around(tip, sway + tendril.width)]
      })]
    }).map(([along, up, out]): PartyOffset => [along, Math.max(up, floor), out])
  }

  sound(audio: AudioOutput, site: PartySite) {
    playFleshGroan(audio, site, lashingTendrils)
  }
}
