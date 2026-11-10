import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import playBatSwarm from './batSwarm.ts'
import {batOffset, flyingBats} from './flights.ts'
import SwarmingBats from './SwarmingBats.ts'

/** A swarm of bats bursts out of its origin, whirls around it, squeaking and fluttering, and flies off into the dark. */
export default class BatsEffect extends PartyEffect {
  readonly duration = Math.max(...flyingBats.map(({delay, life}) => delay + life))
  readonly id = 'bats'
  readonly title = 'Bats'

  createSprites() {
    return new SwarmingBats(flyingBats)
  }

  /** Every bat with its wings spread, from bursting out, or `since`, until it has faded halfway away. */
  extent(_floor: number, since = 0) {
    return flyingBats.flatMap(bat => moments(Math.max(0, since - bat.delay), bat.life * 0.85, 8).flatMap(seconds => around(batOffset(bat, seconds), bat.size / 2)))
  }

  sound(audio: AudioOutput, site: PartySite) {
    playBatSwarm(audio, site, flyingBats)
  }
}
