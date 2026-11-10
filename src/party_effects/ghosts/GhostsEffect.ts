import type {PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around, moments} from '../lib/partySite.ts'
import EscapingGhosts from './EscapingGhosts.ts'
import {escapingGhosts, ghostOffset} from './flights.ts'
import playGhostChorus from './ghostChorus.ts'

/** Ghosts escape their origin: they burst out startled, then spiral up into the room, wailing, and fade away. */
export default class GhostsEffect extends PartyEffect {
  readonly duration = Math.max(...escapingGhosts.map(({delay, life}) => delay + life))
  readonly id = 'ghosts'
  readonly title = 'Ghosts'

  createSprites() {
    return new EscapingGhosts(escapingGhosts)
  }

  /** Every ghost’s head with its sheet round it, from escaping, or `since`, until it has blurred away. */
  extent(_floor: number, since = 0) {
    return escapingGhosts.flatMap(ghost => moments(Math.max(0, since - ghost.delay), ghost.life * 0.85, 8).flatMap(seconds => around(ghostOffset(ghost, seconds), ghost.size * 0.6)))
  }

  sound(audio: AudioOutput, {center}: PartySite) {
    playGhostChorus(audio, center, escapingGhosts)
  }
}
