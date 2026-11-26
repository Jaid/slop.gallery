import type {PartyOffset, PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import PartyEffect from '../base/PartyEffect.ts'
import CrystalFlurry, {flurry} from './CrystalFlurry.ts'

export default class FlurryEffect extends PartyEffect {
  readonly duration = flurry.delay + flurry.life
  readonly id = 'flurry'
  readonly title = 'Crystal flurry'

  createSprites() {
    return new CrystalFlurry
  }

  /** Bound the expanding cone in slices. Only slices a flake could still visit are needed after `since`. */
  extent(floor: number, since = 0): Array<PartyOffset> {
    if (since > this.duration) {
      return []
    }
    const bounds: Array<PartyOffset> = []
    const {delay, fall, life, lift, out, radius, spread} = flurry
    const first = Math.floor(Math.max(0, since - delay) / life * 8)
    for (let slice = Math.min(7, first); slice < 8; slice++) {
      const near = slice / 8
      const far = (slice + 1) / 8
      const reach = (1 - Math.exp(-5 * far)) * spread
      const forward = (p: number) => (0.35 * (1 - Math.exp(-5 * p)) + p * 0.65) * out
      for (const x of [-reach - radius, reach + radius]) {
        for (const y of [Math.max(floor, -reach * 0.62 - fall * far ** 2 - radius), Math.max(floor + radius * 2, reach * 0.62 + lift + radius)]) {
          for (const z of [forward(near) * 0.33 - radius, forward(far) + radius]) {
            bounds.push([x, y, z])
          }
        }
      }
    }
    return bounds
  }

  sound(audio: AudioOutput, site: PartySite) {
    const sound = new EffectSound(audio, site.center, {
      brightness: 0.7,
      decay: 0.25,
      length: 1,
      wet: 0.14,
    })
    const {now} = sound
    sound.hiss(now, 1.85, {
      attack: 0.14,
      hold: 0.22,
      volume: 0.2,
      filter: {
        type: 'bandpass',
        frequency: 620,
        end: 2400,
        q: 0.75,
      },
    })
    // Little pairs of inharmonic partials ringing out of the gust like chips of struck glass.
    for (const [delay, hz] of [[0.05, 1150], [0.28, 1720], [0.51, 1435], [1.08, 2290], [1.76, 1920], [2.16, 2870]]) {
      sound.tone(now + delay, 0.64, {
        frequency: hz,
        volume: 0.037,
        attack: 0.008,
      })
      sound.tone(now + delay, 0.18, {
        frequency: hz * 2.69,
        volume: 0.011,
      })
    }
    sound.finish(1)
  }
}
