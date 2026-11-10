import type {PortalFrame} from '#src/lib/gallery/fusion/portalFrame.ts'
import type {AudioOutput} from 'procedural-audio'

import playBatSwarm from '#src/lib/audio/batSwarm.ts'

import EmergenceEffect from '../base/EmergenceEffect.ts'
import {around, moments} from '../base/portalOffset.ts'
import {batOffset, flyingBats} from './flights.ts'
import SwarmingBats from './SwarmingBats.ts'

/** A swarm of bats bursts out of the portal as the result of a successful fusion flips out, whirls around it, squeaking and fluttering, and flies off into the dark. */
export default class BatsEffect extends EmergenceEffect {
  override readonly afterglow = Math.max(...flyingBats.map(({delay, life}) => delay + life))
  readonly id = 'halloween-bats'

  createSprites() {
    return new SwarmingBats(flyingBats)
  }

  /** Every bat with its wings spread, from bursting out, or `since`, until it has faded halfway away. */
  extent(_floor: number, since = 0) {
    return flyingBats.flatMap(bat => moments(Math.max(0, since - bat.delay), bat.life * 0.85, 8).flatMap(seconds => around(batOffset(bat, seconds), bat.size / 2)))
  }

  sound(audio: AudioOutput, frame: PortalFrame) {
    playBatSwarm(audio, frame, flyingBats)
  }
}
