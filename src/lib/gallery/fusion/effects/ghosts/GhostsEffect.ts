import type {PortalFrame} from '#src/lib/gallery/fusion/portalFrame.ts'
import type {AudioOutput} from 'procedural-audio'

import playGhostChorus from '#src/lib/audio/ghostChorus.ts'

import EmergenceEffect from '../base/EmergenceEffect.ts'
import {around, moments} from '../base/portalOffset.ts'
import EscapingGhosts from './EscapingGhosts.ts'
import {escapingGhosts, ghostOffset} from './flights.ts'

/** Ghosts escape the portal as the result of a successful fusion flips out: they burst out startled, then spiral up into the room, wailing, and fade away. */
export default class GhostsEffect extends EmergenceEffect {
  override readonly afterglow = Math.max(...escapingGhosts.map(({delay, life}) => delay + life))
  readonly id = 'spook-ghosts'

  createSprites() {
    return new EscapingGhosts(escapingGhosts)
  }

  /** Every ghost’s head with its sheet round it, from escaping, or `since`, until it has blurred away. */
  extent(_floor: number, since = 0) {
    return escapingGhosts.flatMap(ghost => moments(Math.max(0, since - ghost.delay), ghost.life * 0.85, 8).flatMap(seconds => around(ghostOffset(ghost, seconds), ghost.size * 0.6)))
  }

  sound(audio: AudioOutput, {center}: PortalFrame) {
    playGhostChorus(audio, center, escapingGhosts)
  }
}
