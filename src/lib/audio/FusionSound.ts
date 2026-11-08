import type {IngredientLatch} from '../gallery/fusion/FusionRecipe.ts'
import type {FusionTiming} from '../gallery/fusion/timing.ts'
import type {Vec3} from '../gallery/types.ts'
import type {AudioOutput} from './proceduralAudio.ts'

import {choreographed, drags, emberRhythm, gathering, grab, ignition, implosion, introSeconds, release, whirl, whirled, whirling, yank} from '../gallery/fusion/intro.ts'
import {introTurns} from '../gallery/fusion/timing.ts'
import {whiteNoise} from './ambience/base/noise.ts'
import atContextTime from './atContextTime.ts'

type Tone = {
  attack?: number
  /** the frequency it glides to by its end, exponentially */
  end?: number
  frequency: number
  type?: OscillatorType
  /** a slow vibrato: how many hertz it swings and how many times a second */
  vibrato?: readonly [depth: number, rate: number]
  volume: number
}
type Hiss = {
  attack?: number
  /** the filter’s frequency by the hiss’s end, exponentially */
  end?: number
  filter: BiquadFilterType
  frequency: number
  q?: number
  volume: number
}
/** the beds that run while the portal is open, which the frame keeps following the portal */
type Beds = {
  hum: GainNode
  humFilter: BiquadFilterNode
  humTones: Array<OscillatorNode>
  shimmer: GainNode
  whoosh: GainNode
  whooshRate: OscillatorNode
}

const silence = 0.0001
/** the tones a bell rings, as multiples of its pitch with their share of its volume and how long they ring */
const bellPartials = [[1, 1, 1], [2.01, 0.45, 0.66], [2.76, 0.32, 0.5], [4.07, 0.18, 0.34], [5.43, 0.1, 0.25]] as const
/** the pitches the images surface with, one after another: a gentle rising motif, which starts with the first turn after the lull, so it plays once in full until the minimum */
const surfacing = [659.25, 783.99, 987.77, 880]
/** the pitches the ember latches the ingredients on with, one for each of at most four, the last of them for as many ingredients as there are: rising through E major to G♯, which leads into the ignition’s A major */
const latchPitches = [277.18, 329.63, 369.99, 415.3]
/** the chord the result flips out on */
const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51]
const impulses = new WeakMap<BaseAudioContext, AudioBuffer>
/** A shimmering space for the portal’s sounds to ring in: two seconds of decaying stereo noise, brighter at first. */
function impulse(context: BaseAudioContext) {
  let buffer = impulses.get(context)
  if (!buffer) {
    const length = Math.ceil(context.sampleRate * 2.2)
    buffer = context.createBuffer(2, length, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let smooth = 0
      for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate
        // Smoothed noise darkens the tail, which keeps the high glitter from lingering.
        const white = Math.random() * 2 - 1
        smooth += (white - smooth) * Math.max(0.05, 1 - t * 0.6)
        data[i] = smooth * Math.exp(-t / 0.5) * (t < 0.018 ? 0 : 1)
      }
    }
    impulses.set(context, buffer)
  }
  return buffer
}

/**
 * The sound of a fusion, synthesized live and heard from its portal through an HRTF panner: its intro’s own, a low hum, a shimmer and the whoosh of the orbit while the portal brews, a bell for every image that surfaces in it, a rising rush through the climax and a boom with a fanfare when the result flips out – or a sputtering fall when it fizzles, after a crack and a screech if the player broke it off.
 * Everything rings in a short, bright reverb. It plays on the sound engine’s effects master, which the mute covers.
 */
export default class FusionSound {
  private beds?: Beds
  /** whether the player broke the fusion off */
  private broken = false
  private readonly bus: GainNode
  private readonly context: BaseAudioContext
  private readonly panner: PannerNode
  private readonly sources = new Set<AudioScheduledSourceNode>
  private stopped = false

  constructor({context, master}: AudioOutput, [x, y, z]: Vec3) {
    this.context = context
    this.panner = new PannerNode(context, {
      panningModel: 'HRTF',
      distanceModel: 'linear',
      refDistance: 2.5,
      maxDistance: 24,
      rolloffFactor: 1,
      positionX: x,
      positionY: y,
      positionZ: z,
    })
    this.panner.connect(master)
    this.bus = new GainNode(context, {gain: 1})
    this.bus.connect(this.panner)
    const reverb = new ConvolverNode(context, {buffer: impulse(context)})
    this.bus.connect(reverb).connect(new GainNode(context, {gain: 0.35})).connect(this.panner)
  }

  /** The climax: a rush that rises over `duration` seconds while the hum climbs with the vortex. */
  climax(duration: number) {
    if (this.stopped) {
      return
    }
    const now = this.context.currentTime
    this.tone(now, duration + 0.15, {
      frequency: 180,
      end: 1400,
      volume: 0.045,
      attack: duration * 0.85,
      type: 'triangle',
    })
    this.hiss(now, duration + 0.1, {
      filter: 'highpass',
      frequency: 700,
      end: 9000,
      volume: 0.05,
      attack: duration * 0.9,
    })
  }

  /** The result flips out: a deep boom, a blast of air, a fanfare of bells and a spray of glitter, while the hum breaks off. */
  emerge() {
    if (this.stopped) {
      return
    }
    const now = this.context.currentTime
    this.tone(now, 1.1, {
      frequency: 130,
      end: 34,
      volume: 0.13,
      attack: 0.004,
    })
    this.hiss(now, 0.9, {
      filter: 'lowpass',
      frequency: 3200,
      end: 150,
      volume: 0.11,
      attack: 0.004,
    })
    for (const [index, frequency] of fanfare.entries()) {
      this.bell(now + 0.03 + index * 0.035, frequency, 0.024, 2.2)
    }
    for (let index = 0; index < 16; index++) {
      const start = now + 0.05 + Math.random() * 0.9
      this.tone(start, 0.06 + Math.random() * 0.1, {
        frequency: 2500 + Math.random() * 4500,
        volume: 0.01,
        attack: 0.002,
      })
    }
    this.release(0.12, 1.4)
  }

  /** The fusion failed: a sputtering, wobbling fall over `duration` seconds, crackling, with a dull pop as the portal gives out, while the hum sinks away. */
  fizzle(duration: number) {
    if (this.stopped) {
      return
    }
    const now = this.context.currentTime
    this.tone(now, duration * 0.9, {
      frequency: 520,
      end: 70,
      volume: 0.05,
      vibrato: [40, 11],
      type: 'triangle',
    })
    for (let index = 0; index < 12; index++) {
      this.hiss(now + Math.random() * duration * 0.8, 0.03 + Math.random() * 0.05, {
        filter: 'bandpass',
        frequency: 1500 + Math.random() * 2500,
        q: 4,
        volume: 0.05,
        attack: 0.002,
      })
    }
    const pop = now + duration * 0.55
    this.tone(pop, 0.25, {
      frequency: 300,
      end: 70,
      volume: 0.09,
      attack: 0.003,
    })
    this.hiss(pop, 0.2, {
      filter: 'lowpass',
      frequency: 1800,
      end: 200,
      volume: 0.06,
      attack: 0.003,
    })
    if (this.beds) {
      for (const tone of this.beds.humTones) {
        tone.detune.setTargetAtTime(-1200, now, duration / 3)
      }
    }
    this.release(duration * 0.3, duration * 0.4)
  }

  /** The portal of a fusion whose ingredients latch on as `latches` says opens `elapsed` seconds into it: the beds start, and whatever of the intro’s sound is still to come plays. */
  open(timing: FusionTiming, latches: ReadonlyArray<IngredientLatch>, elapsed = 0) {
    if (this.stopped || this.beds) {
      return
    }
    const now = this.context.currentTime
    if (elapsed < timing.intro) {
      this.intro(now - elapsed, timing, latches)
    }
    this.beds = this.startBeds(now)
  }

  /** The player broke the fusion off: a crack like breaking glass, a jarring screech sliding down over a dull thud, and the hum lurching flat, where it wavers until the portal fizzles. */
  recoil() {
    if (this.stopped) {
      return
    }
    const now = this.context.currentTime
    this.hiss(now, 0.14, {
      filter: 'highpass',
      frequency: 3500,
      end: 900,
      volume: 0.14,
      attack: 0.001,
    })
    this.tone(now, 0.3, {
      frequency: 110,
      end: 38,
      volume: 0.15,
      attack: 0.002,
    })
    // Two tones a little apart grate against each other.
    for (const frequency of [1240, 1318]) {
      this.tone(now + 0.01, 0.55, {
        frequency,
        end: frequency * 0.4,
        volume: 0.018,
        attack: 0.004,
        type: 'sawtooth',
        vibrato: [35, 17],
      })
    }
    this.broken = true
  }

  /** Stops every sound, fading out over `fade` seconds, and releases the nodes. */
  stop(fade = 0.3) {
    if (this.stopped) {
      return
    }
    this.stopped = true
    const now = this.context.currentTime
    this.bus.gain.cancelScheduledValues(now)
    this.bus.gain.setTargetAtTime(0, now, fade / 4)
    for (const source of this.sources) {
      source.stop(now + fade)
    }
    // The reverb rings on for a while after the last source.
    atContextTime(this.context, now + fade + 2.4, () => this.panner.disconnect())
  }

  /** An image surfaces in the portal after the lull: a bell with a slow vibrato over a soft rush, each one a step further along the motif. The intro’s turns stay silent here, as their ingredients are latched on with beats of the intro’s own sound. */
  surface(turn: number) {
    if (this.stopped || turn < introTurns) {
      return
    }
    const now = this.context.currentTime
    const step = (turn - introTurns) % surfacing.length
    this.bell(now, surfacing.at(step)!, 0.03, 1.8, [5, 5.5])
    this.hiss(now, 0.7, {
      filter: 'lowpass',
      frequency: 2200,
      end: 400,
      volume: 0.035,
      attack: 0.12,
    })
  }

  /** Follows the portal every frame: the hum swells with its energy and climbs with its vortex, and the orbit’s whoosh passes as often as the satellites do. */
  update({energy, orbit, spin}: {
    energy: number
    /** radians per second the satellites circle the portal at */
    orbit: number
    /** radians per second the vortex turns */
    spin: number
  }) {
    const {beds} = this
    if (!beds || this.stopped) {
      return
    }
    const now = this.context.currentTime
    const level = Math.min(energy, 2)
    beds.hum.gain.setTargetAtTime(level, now, 0.08)
    beds.humFilter.frequency.setTargetAtTime(300 + level * 500, now, 0.08)
    // Broken off, it sags by a minor third and wavers.
    const cents = 1200 * Math.log2(1 + Math.max(0, spin - 1.6) * 0.035) + (this.broken ? -300 + 45 * Math.sin(now * 14) : 0)
    for (const tone of beds.humTones) {
      tone.detune.setTargetAtTime(cents, now, 0.1)
    }
    beds.shimmer.gain.setTargetAtTime(level * 0.008, now, 0.1)
    // Two satellites pass the front once each per turn.
    beds.whooshRate.frequency.setTargetAtTime(Math.max(0.05, orbit / Math.PI), now, 0.1)
    beds.whoosh.gain.setTargetAtTime(level * 0.022, now, 0.1)
  }

  /** A bell of the partials, with an optional vibrato. */
  private bell(start: number, frequency: number, volume: number, ring: number, vibrato?: readonly [number, number]) {
    for (const [ratio, share, length] of bellPartials) {
      this.tone(start, ring * length, {
        frequency: frequency * ratio,
        volume: volume * share,
        attack: 0.003,
        vibrato: vibrato ? [vibrato[0] * ratio, vibrato[1]] : undefined,
      })
    }
  }

  /** Filtered noise. */
  private hiss(start: number, duration: number, {attack = 0.01, end, filter, frequency, q = 1, volume}: Hiss) {
    if (this.past(start)) {
      return
    }
    const source = new AudioBufferSourceNode(this.context, {buffer: whiteNoise(this.context)})
    const shaping = new BiquadFilterNode(this.context, {
      type: filter,
      frequency,
      Q: q,
    })
    if (end) {
      shaping.frequency.setValueAtTime(frequency, start)
      shaping.frequency.exponentialRampToValueAtTime(end, start + duration)
    }
    this.play(source.connect(shaping), source, start, duration, volume, attack, Math.random() * 3)
  }

  /** The intro (see `intro.ts`) that starts at `start`: a pinprick of glass and an inhale rising over a pressure drop while the work rattles and is dragged in, a crack, a boom and a gong as the singularity bursts, a swarm of glints as the motes stream back in, the ember’s heartbeat, a beat latching each ingredient on with a magnetic clamp charging up, an orb pinging like glass besides, rising toward the ignition, and yanking it in with a whoosh, and a last one igniting the portal with a short roar and a chord, and the portal’s slingshot: the zip of its tethers lashing out, a whir climbing to a howl under whooshes passing ever faster while it whirls them around, a snap and a twang as it lets go, a rush as the ring of fire falls in and a boom, a blast of air, a bright chord and glitter as it lands. */
  private intro(start: number, timing: FusionTiming, kinds: ReadonlyArray<IngredientLatch>) {
    const ingredients = kinds.length
    const at = (seconds: number) => start + introSeconds(seconds, timing)
    const until = (from: number, to: number) => introSeconds(to - from, timing)
    const {beats, dub} = emberRhythm(ingredients)
    // A pinprick of glass.
    this.tone(at(0), 0.25, {
      frequency: 3100,
      end: 2400,
      volume: 0.02,
      attack: 0.002,
    })
    this.bell(at(0.01), 1568, 0.012, 0.6)
    // The inhale: air rushing in, ever higher, over a pressure drop and a rising screech.
    this.hiss(at(0.02), until(0.05, implosion), {
      filter: 'bandpass',
      frequency: 180,
      end: 2600,
      q: 2.5,
      volume: 0.11,
      attack: until(0.12, implosion),
    })
    this.hiss(at(0.02), until(0.05, implosion), {
      filter: 'lowpass',
      frequency: 300,
      end: 900,
      volume: 0.07,
      attack: until(0.25, implosion),
    })
    this.tone(at(0.02), until(0, implosion), {
      frequency: 72,
      end: 26,
      volume: 0.13,
      attack: until(0.25, implosion),
    })
    this.tone(at(0.1), until(0.1, implosion), {
      frequency: 140,
      end: 1100,
      volume: 0.016,
      attack: until(0.15, implosion),
      type: 'sawtooth',
    })
    // The work rattles on its wall before it tears loose.
    for (let index = 0; index < 7; index++) {
      this.hiss(at(0.02 + index * 0.019 + index % 2 * 0.005), 0.022, {
        filter: 'bandpass',
        frequency: 2300 + index % 3 * 600,
        q: 6,
        volume: 0.03 + index * 0.004,
        attack: 0.001,
      })
    }
    // Each is dragged in with a whoosh.
    for (const drag of drags.slice(0, ingredients)) {
      this.hiss(at(drag), until(drag, implosion), {
        filter: 'bandpass',
        frequency: 500,
        end: 3200,
        q: 1.2,
        volume: 0.05,
        attack: until(drag + 0.05, implosion),
      })
    }
    // The burst: a crack, a deep boom and a gong ringing out, standing out over the inhale it ends.
    this.hiss(at(implosion), 0.06, {
      filter: 'highpass',
      frequency: 3000,
      volume: 0.08,
      attack: 0.001,
    })
    this.tone(at(implosion), 1.4, {
      frequency: 120,
      end: 28,
      volume: 0.14,
      attack: 0.004,
    })
    this.hiss(at(implosion), 1, {
      filter: 'lowpass',
      frequency: 5000,
      end: 120,
      volume: 0.1,
      attack: 0.004,
    })
    this.bell(at(implosion + 0.02), 196, 0.022, 2.6)
    // The motes stream back in: a swarm of tiny glints, ever denser and brighter, over a soft rising hiss and a swelling hum.
    const [gatherFrom, gatherTo] = gathering
    for (let index = 0; index < 40; index++) {
      const share = Math.sqrt(index / 40)
      this.tone(at(gatherFrom + (gatherTo - gatherFrom) * share), 0.05 + Math.random() * 0.06, {
        frequency: 2200 + Math.random() * 4000 + 1500 * share,
        volume: 0.004 + 0.007 * share,
        attack: 0.002,
      })
    }
    this.hiss(at(gatherFrom), until(gatherFrom, gatherTo), {
      filter: 'highpass',
      frequency: 3000,
      end: 6000,
      volume: 0.02,
      attack: until(gatherFrom + 0.1, gatherTo),
    })
    this.tone(at(gatherFrom), until(gatherFrom, beats[0]) + 0.1, {
      frequency: 60,
      end: 90,
      volume: 0.05,
      attack: until(gatherFrom + 0.1, beats[0]),
    })
    for (const [index, beat] of beats.entries()) {
      const strength = index === beats.length - 1 ? 1.5 : 1
      // Lub, dub.
      this.tone(at(beat), 0.32, {
        frequency: 82,
        end: 38,
        volume: 0.15 * strength,
        attack: 0.004,
      })
      this.tone(at(beat) + introSeconds(dub, timing), 0.26, {
        frequency: 70,
        end: 34,
        volume: 0.09 * strength,
        attack: 0.004,
      })
      this.hiss(at(beat), 0.12, {
        filter: 'lowpass',
        frequency: 900,
        end: 150,
        volume: 0.06 * strength,
        attack: 0.003,
      })
      if (!(index < ingredients)) {
        continue
      }
      // It yanks its satellite in with a whoosh.
      this.hiss(at(beat + yank), 0.45, {
        filter: 'bandpass',
        frequency: 1800,
        end: 500,
        q: 1.3,
        volume: 0.05,
        attack: 0.03,
      })
      this.latch(at(beat), latchPitches[latchPitches.length - ingredients + index], kinds[index])
    }
    // The last beat ignites it: a short roar and a chord.
    this.hiss(at(ignition), 0.5, {
      filter: 'bandpass',
      frequency: 300,
      end: 2500,
      q: 0.7,
      volume: 0.07,
      attack: 0.05,
    })
    for (const [index, frequency] of [440, 554.37, 659.25].entries()) {
      this.bell(at(ignition) + 0.04 + index * 0.04, frequency, 0.013, 1.1)
    }
    // Each tether lashes out with a zip.
    for (let index = 0; index < ingredients; index++) {
      this.hiss(at(grab(index)), 0.07, {
        filter: 'bandpass',
        frequency: 2400,
        end: 5000,
        q: 2.5,
        volume: 0.045,
        attack: 0.002,
      })
    }
    // The whirl: a whir climbing to a howl and whooshes passing ever faster, six a lap, each a little higher.
    const whirlUp = until(whirl, release)
    this.tone(at(whirl), whirlUp + 0.04, {
      frequency: 80,
      end: 420,
      volume: 0.03,
      attack: whirlUp * 0.95,
      type: 'triangle',
      vibrato: [8, 13],
    })
    this.hiss(at(whirl), whirlUp + 0.03, {
      filter: 'bandpass',
      frequency: 400,
      end: 3000,
      q: 1.4,
      volume: 0.075,
      attack: whirlUp * 0.95,
    })
    let passes = 0
    for (let moment: number = whirl; moment < choreographed; moment += 0.002) {
      const due = Math.floor(whirled(moment) / (Math.PI / 3))
      if (due <= passes) {
        continue
      }
      passes = due
      const speed = whirling(moment)
      this.hiss(at(moment), 0.07 + 0.12 * (1 - speed), {
        filter: 'bandpass',
        frequency: 500 + 1800 * speed,
        q: 1.8,
        volume: 0.03 + 0.08 * speed,
        attack: 0.03 + 0.04 * (1 - speed),
      })
    }
    // It lets go: a snap and a twang, while the ring of fire falls in with a rush sucked into the portal.
    this.hiss(at(release), 0.04, {
      filter: 'highpass',
      frequency: 3600,
      volume: 0.13,
      attack: 0.001,
    })
    this.tone(at(release), 0.22, {
      frequency: 1300,
      end: 320,
      volume: 0.022,
      attack: 0.002,
      type: 'triangle',
    })
    const falling = until(release, choreographed)
    this.hiss(at(release), falling + 0.02, {
      filter: 'lowpass',
      frequency: 300,
      end: 5000,
      volume: 0.09,
      attack: falling * 0.95,
    })
    this.tone(at(release), falling, {
      frequency: 300,
      end: 1500,
      volume: 0.012,
      attack: falling * 0.9,
    })
    // It lands: a boom, a blast of air, a bright chord and glitter.
    this.tone(at(choreographed), 1.2, {
      frequency: 120,
      end: 32,
      volume: 0.15,
      attack: 0.004,
    })
    this.hiss(at(choreographed), 0.8, {
      filter: 'lowpass',
      frequency: 4500,
      end: 150,
      volume: 0.09,
      attack: 0.004,
    })
    for (const [index, frequency] of [659.25, 830.61, 987.77, 1318.51].entries()) {
      this.bell(at(choreographed) + 0.02 + index * 0.03, frequency, 0.02, 2.2)
    }
    for (let index = 0; index < 12; index++) {
      this.tone(at(choreographed) + 0.04 + Math.random() * 0.7, 0.05 + Math.random() * 0.08, {
        frequency: 2600 + Math.random() * 4200,
        volume: 0.008,
        attack: 0.002,
      })
    }
  }

  /** An ingredient latched on to the ember at `start`, charging up like a magnetic clamp: a buzzing square rises from an octave below `frequency` to an octave above it over the 50 ms leading into the beat, and a sub thump an octave below and a fizz land on it. Dry and short, nothing like the bells. A glass ball like an orb pings on the beat besides, two octaves up with a faint inharmonic overtone, over a tiny high click. */
  private latch(start: number, frequency: number, kind: IngredientLatch) {
    this.tone(start - 0.05, 0.075, {
      frequency: frequency / 2,
      end: frequency * 2,
      volume: 0.012,
      attack: 0.045,
      type: 'square',
    })
    this.tone(start, 0.2, {
      frequency: frequency / 2,
      end: frequency / 2.2,
      volume: 0.06,
      attack: 0.002,
    })
    this.hiss(start, 0.04, {
      filter: 'highpass',
      frequency: 6000,
      end: 3000,
      volume: 0.04,
      attack: 0.001,
    })
    if (kind !== 'glass') {
      return
    }
    this.tone(start, 0.35, {
      frequency: frequency * 4,
      volume: 0.022,
      attack: 0.001,
    })
    this.tone(start, 0.18, {
      frequency: frequency * 4 * 2.76,
      volume: 0.006,
      attack: 0.001,
    })
    this.hiss(start, 0.012, {
      filter: 'highpass',
      frequency: 7000,
      volume: 0.035,
      attack: 0.0005,
    })
  }

  /** whether a sound due at `start` is already over, like the start of an intro the sound engine was made too late for */
  private past(start: number) {
    return this.stopped || start < this.context.currentTime - 0.02
  }

  private play(through: AudioNode, source: AudioScheduledSourceNode, start: number, duration: number, volume: number, attack: number, offset?: number) {
    const envelope = new GainNode(this.context, {gain: 0})
    const peak = Math.min(attack, duration * 0.9)
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(volume, start + peak)
    envelope.gain.exponentialRampToValueAtTime(silence, start + duration)
    through.connect(envelope).connect(this.bus)
    this.sources.add(source)
    source.addEventListener('ended', () => {
      this.sources.delete(source)
      source.disconnect()
      through.disconnect()
      envelope.disconnect()
    }, {once: true})
    if (source instanceof AudioBufferSourceNode) {
      source.start(start, offset)
    } else {
      source.start(start)
    }
    source.stop(start + duration + 0.02)
  }

  /** Lets the beds go: the hum breaks off after `hum` seconds, the shimmer and the whoosh fade over `rest`. */
  private release(hum: number, rest: number) {
    const {beds} = this
    if (!beds) {
      return
    }
    this.beds = undefined
    const now = this.context.currentTime
    beds.hum.gain.cancelScheduledValues(now)
    beds.hum.gain.setTargetAtTime(0, now + hum * 0.5, hum / 3)
    for (const gain of [beds.shimmer.gain, beds.whoosh.gain]) {
      gain.cancelScheduledValues(now)
      gain.setTargetAtTime(0, now, rest / 3)
    }
  }

  /** The beds: a hum of a low fifth and its octaves through a resonant lowpass, a high shimmer trembling seven times a second and a whoosh that swells as the satellites pass. */
  private startBeds(now: number): Beds {
    const {context} = this
    const hum = new GainNode(context, {gain: 0})
    const humFilter = new BiquadFilterNode(context, {
      type: 'lowpass',
      frequency: 300,
      Q: 4,
    })
    humFilter.connect(hum).connect(this.bus)
    const humTones = ([[55, 'sine', 0.02], [110.4, 'triangle', 0.013], [164.8, 'sine', 0.007], [220.6, 'sine', 0.005]] as const).map(([frequency, type, volume]) => {
      const tone = new OscillatorNode(context, {
        frequency,
        type,
      })
      tone.connect(new GainNode(context, {gain: volume})).connect(humFilter)
      return tone
    })
    const shimmer = new GainNode(context, {gain: 0})
    const shimmerNoise = new AudioBufferSourceNode(context, {
      buffer: whiteNoise(context),
      loop: true,
    })
    const tremble = new GainNode(context, {gain: 0.5})
    const trembleRate = new OscillatorNode(context, {frequency: 7})
    trembleRate.connect(new GainNode(context, {gain: 0.5})).connect(tremble.gain)
    shimmerNoise.connect(new BiquadFilterNode(context, {
      type: 'bandpass',
      frequency: 6500,
      Q: 3,
    })).connect(tremble).connect(shimmer).connect(this.bus)
    const whoosh = new GainNode(context, {gain: 0})
    const whooshNoise = new AudioBufferSourceNode(context, {
      buffer: whiteNoise(context),
      loop: true,
    })
    const swell = new GainNode(context, {gain: 0.5})
    const whooshRate = new OscillatorNode(context, {frequency: 0.46})
    whooshRate.connect(new GainNode(context, {gain: 0.5})).connect(swell.gain)
    whooshNoise.connect(new BiquadFilterNode(context, {
      type: 'bandpass',
      frequency: 900,
      Q: 1.1,
    })).connect(swell).connect(whoosh).connect(this.bus)
    for (const source of [...humTones, shimmerNoise, trembleRate, whooshNoise, whooshRate]) {
      this.sources.add(source)
      source.start(now, source instanceof AudioBufferSourceNode ? Math.random() * 5 : undefined)
    }
    return {
      hum,
      humFilter,
      humTones,
      shimmer,
      whoosh,
      whooshRate,
    }
  }

  /** An oscillator, gliding and wobbling if asked to. */
  private tone(start: number, duration: number, {attack = 0.005, end, frequency, type = 'sine', vibrato, volume}: Tone) {
    if (this.past(start)) {
      return
    }
    const oscillator = new OscillatorNode(this.context, {
      frequency,
      type,
    })
    if (end) {
      oscillator.frequency.setValueAtTime(frequency, start)
      oscillator.frequency.exponentialRampToValueAtTime(end, start + duration)
    }
    if (vibrato) {
      const wobble = new OscillatorNode(this.context, {frequency: vibrato[1]})
      wobble.connect(new GainNode(this.context, {gain: vibrato[0]})).connect(oscillator.frequency)
      wobble.start(start)
      wobble.stop(start + duration + 0.02)
      this.sources.add(wobble)
      wobble.addEventListener('ended', () => {
        this.sources.delete(wobble)
        wobble.disconnect()
      }, {once: true})
    }
    this.play(oscillator, oscillator, start, duration, volume, attack)
  }
}
