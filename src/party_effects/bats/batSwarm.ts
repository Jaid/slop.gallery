import type {PartySite} from '../lib/partySite.ts'
import type {FlyingBat} from './flights.ts'
import type {AudioOutput} from 'procedural-audio'

import {whiteNoise} from 'procedural-audio'

import EffectSound from '#src/lib/audio/EffectSound.ts'

import {offsetPosition} from '../lib/partySite.ts'
import {batOffset} from './flights.ts'

/** the leathery flutter of the swarm’s wings: how many times a second each layer flaps and where its noise rings, in hertz */
const flutters = [[10.5, 1100], [12.7, 1500], [14.9, 850]] as const

/**
 * The sound of bats bursting out of the origin at `site`, from now on: a gust as they burst out, the leathery flutter of their wings in three layers flapping at their own rates, which swells while they stream out and rises with them as they fly off, and the high squeaks of a dozen of them, each heard from where its bat is at that moment, all in a small, dry room.
 * It cleans up after itself once it has rung out.
 */
export default function playBatSwarm(output: AudioOutput, site: PartySite, bats: ReadonlyArray<FlyingBat>) {
  const sound = new EffectSound(output, site.center, {
    brightness: 0.6,
    decay: 0.35,
    length: 1.4,
    wet: 0.28,
  })
  const {context, now} = sound
  const flight = Math.max(...bats.map(({delay, life}) => delay + life))
  // The swarm drifts out into the room and up while it flies off.
  sound.glide(offsetPosition(site, [0, 1.2, 1]), now + flight)
  sound.hiss(now + 0.06, 0.75, {
    filter: {
      type: 'bandpass',
      frequency: 320,
      end: 1900,
      q: 0.9,
    },
    volume: 0.14,
    attack: 0.08,
  })
  for (const [index, [rate, frequency]] of flutters.entries()) {
    const start = now + 0.1 + index * 0.05
    const duration = flight * 0.9
    const source = sound.keep(new AudioBufferSourceNode(context, {buffer: whiteNoise(context)}))
    const filter = sound.keep(new BiquadFilterNode(context, {
      type: 'bandpass',
      frequency,
      Q: 1.3,
    }))
    // Every flap is a short rush of air: the noise swells with a sawtooth that drops off at once.
    const flapping = sound.keep(new GainNode(context, {gain: 0.5}))
    const beat = sound.keep(new OscillatorNode(context, {
      type: 'sawtooth',
      frequency: rate,
    }))
    const depth = sound.keep(new GainNode(context, {gain: 0.5}))
    beat.connect(depth).connect(flapping.gain)
    source.connect(filter).connect(flapping)
    sound.envelope(flapping, start, duration, {
      volume: 0.17,
      attack: 0.3,
      hold: duration * 0.25,
    })
    source.start(start, Math.random() * 3)
    source.stop(start + duration + 0.02)
    beat.start(start)
    beat.stop(start + duration + 0.02)
  }
  // Every other bat squeaks once or twice while it whirls around, high and gliding down, from where it is.
  for (const [index, bat] of bats.entries()) {
    if (index % 2) {
      continue
    }
    const share = bat.phase / (Math.PI * 2)
    const squeaks = share > 0.6 ? 2 : 1
    const at = bat.delay + 0.15 + share * bat.life * 0.55
    const panner = sound.pannerAt(offsetPosition(site, batOffset(bat, at - bat.delay)))
    const pitch = 4200 + share * 3400
    for (let squeak = 0; squeak < squeaks; squeak++) {
      sound.tone(now + at + squeak * 0.07, 0.04, {
        frequency: pitch * 1.18,
        end: pitch * 0.72,
        volume: 0.04,
        attack: 0.005,
      }, panner)
    }
  }
  sound.finish(2)
}
