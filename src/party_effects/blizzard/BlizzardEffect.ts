import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around} from '../lib/partySite.ts'
import playBlizzardGust from './blizzardGust.ts'
import {blizzardDone, blizzardOffset, blizzardParticles} from './flights.ts'
import SwirlingBlizzard from './SwirlingBlizzard.ts'

/** seconds between the moments `extent` samples */
const extentStep = 0.25

/** A sudden arctic blizzard bursting out of its origin: billowing freezing spindrift clouds, 6-pointed dendritic snowflakes fluttering on turbulent helical gusts and spinning glacier-ice shards chiming as they flash and sublimate. */
export default class BlizzardEffect extends PartyEffect {
  readonly duration = blizzardDone
  readonly id = 'blizzard'
  readonly title = 'Blizzard'

  createSprites() {
    return new SwirlingBlizzard(blizzardParticles)
  }

  /**
   * Every cloud, snowflake and shard along its helical flight from `since` until it fades away, keeping all extents at or above `floor`.
   * Moments lie on one fixed grid of {@link extentStep}, so what is still to come always lies inside the whole show’s extent.
   */
  extent(floor: number, since = 0) {
    return blizzardParticles.flatMap(particle => {
      if (since > particle.delay + particle.life) {
        return []
      }
      const first = Math.floor(Math.max(0, since - particle.delay) / extentStep)
      const last = Math.ceil(particle.life / extentStep)
      const times = Array.from({length: last - first + 1}, (_, index) => Math.min(particle.life, (first + index) * extentStep))
      const radius = particle.size * 0.55
      return times.flatMap(seconds => {
        const offset = blizzardOffset(particle, seconds, floor)
        return around(offset, radius).map(([along, up, out]) => [along, Math.max(floor, up), out] as const)
      })
    })
  }

  sound(audio: AudioOutput, site: PartySite) {
    playBlizzardGust(audio, site, blizzardParticles)
  }
}
