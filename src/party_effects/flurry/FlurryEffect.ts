import type {PartyOffset, PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import {flakeOffset, snowflakes} from './flights.ts'
import playSnowGust from './snowGust.ts'
import SwirlingSnow from './SwirlingSnow.ts'

/** A flurry of snow bursts out of its origin: a swirling gust of fine snow and great stellar flakes that whirl into the room, flutter down to the floor, rest there a moment and melt away. */
export default class FlurryEffect extends PartyEffect {
  readonly duration = Math.max(...snowflakes.map(({delay, life}) => delay + life))
  readonly id = 'flurry'
  readonly title = 'Snow flurry'

  createSprites() {
    return new SwirlingSnow(snowflakes)
  }

  /** Every flake as wide as it is drawn, from coming out, or `since`, until it has melted, never below the floor it lands on. */
  extent(floor: number, since = 0) {
    const landed = ([along, up, out]: PartyOffset): PartyOffset => [along, Math.max(up, floor), out]
    return snowflakes.flatMap(flake => moments(Math.max(0, since - flake.delay), flake.life, 6).flatMap(seconds => around(flakeOffset(flake, seconds, floor), flake.size * 0.65).map(landed)))
  }

  sound(audio: AudioOutput, site: PartySite) {
    playSnowGust(audio, site, snowflakes)
  }
}
