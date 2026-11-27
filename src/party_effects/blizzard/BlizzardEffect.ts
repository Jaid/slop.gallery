import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import playBlizzardGust from './blizzardGust.ts'
import BlowingSnow from './BlowingSnow.ts'
import {blownFlakes, flakeOffset} from './flights.ts'

/** A blizzard bursts out of its origin: a gust of snowflakes and large ice crystals whirls round it, blowing out into the room with a howl of wind and the ring of ice, and the snow sinks, glittering, settles on the floor and melts away. */
export default class BlizzardEffect extends PartyEffect {
  readonly duration = Math.max(...blownFlakes.map(({delay, life}) => delay + life))
  readonly id = 'blizzard'
  readonly title = 'Blizzard'

  createSprites() {
    return new BlowingSnow(blownFlakes)
  }

  /** Every flake with its arms, from bursting out, or `since`, until it has faded away. */
  extent(floor: number, since = 0) {
    return blownFlakes.flatMap(flake => moments(Math.max(0, since - flake.delay), flake.life * 0.85, 8).flatMap(seconds => around(flakeOffset(flake, seconds, floor), flake.size / 2).map(([along, up, out]) => [along, Math.max(floor, up), out] as const)))
  }

  sound(audio: AudioOutput, site: PartySite) {
    playBlizzardGust(audio, site, blownFlakes)
  }
}
