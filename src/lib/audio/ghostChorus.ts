import type {EscapingGhost} from '../gallery/fusion/effects/ghosts/flights.ts'
import type {Vec3} from '../gallery/types.ts'
import type {AudioOutput} from 'procedural-audio'

import {atContextTime, whiteNoise} from 'procedural-audio'

const silence = 0.0001
/** how high the sound rises with the ghosts over their flight, in meters */
const ascent = 2
/** a vowel the wails sing, by the centers of their two lowest formants, in hertz: “oo” opening up toward “ah” at the height of each wail and closing again */
const vowels = {
  closed: [320, 800],
  open: [560, 1000],
} as const
const impulses = new WeakMap<BaseAudioContext, AudioBuffer>
/**
 * The haunting sound of ghosts escaping a fusion’s portal at `position`, from now on: every ghost wails as it escapes, a voice gliding up and down a slow “oo-ah-oo” with a widening tremble, over a tritone swelling and beating like a held breath, a theremin’s quavering glide and a cold draft rising with them, all ringing in a dark hall.
 * It is heard through an HRTF panner that rises with the ghosts over their flight, and cleans up after itself once it has rung out.
 */
export default function playGhostChorus({context, master}: AudioOutput, [x, y, z]: Vec3, ghosts: ReadonlyArray<EscapingGhost>) {
  const now = context.currentTime
  // seconds until the last ghost is gone
  const flight = Math.max(...ghosts.map(({delay, life}) => delay + life))
  const panner = new PannerNode(context, {
    panningModel: 'HRTF',
    distanceModel: 'linear',
    refDistance: 2.5,
    maxDistance: 28,
    rolloffFactor: 1,
    positionX: x,
    positionY: y,
    positionZ: z,
  })
  panner.positionY.setValueAtTime(y, now)
  panner.positionY.linearRampToValueAtTime(y + ascent, now + flight)
  panner.connect(master)
  const bus = new GainNode(context, {gain: 1})
  bus.connect(panner)
  const reverb = new ConvolverNode(context, {buffer: hall(context)})
  const wet = new GainNode(context, {gain: 0.55})
  bus.connect(reverb).connect(wet).connect(panner)
  const nodes: Array<AudioNode> = [panner, bus, reverb, wet]
  let end = now
  /** Plays `source` through `through` into the bus, rising over `attack` seconds and falling to silence by its end. */
  const play = (source: AudioScheduledSourceNode, through: AudioNode, start: number, duration: number, volume: number, attack: number) => {
    const envelope = new GainNode(context, {gain: 0})
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration * 0.9))
    envelope.gain.exponentialRampToValueAtTime(silence, start + duration)
    through.connect(envelope).connect(bus)
    nodes.push(envelope)
    if (source instanceof AudioBufferSourceNode) {
      source.start(start, Math.random() * 3)
    } else {
      source.start(start)
    }
    source.stop(start + duration + 0.02)
    end = Math.max(end, start + duration)
  }
  /** a slow tremble of `frequency` by up to `depth` hertz, growing in over `duration` seconds from `start` */
  const tremble = (frequency: AudioParam, start: number, duration: number, rate: number, depth: number) => {
    const wobble = new OscillatorNode(context, {frequency: rate})
    const amount = new GainNode(context, {gain: 0})
    amount.gain.setValueAtTime(0, start)
    amount.gain.linearRampToValueAtTime(depth, start + duration * 0.6)
    wobble.connect(amount).connect(frequency)
    wobble.start(start)
    wobble.stop(start + duration + 0.02)
    nodes.push(wobble, amount)
  }
  for (const [index, {delay, life, pitch}] of ghosts.entries()) {
    const start = now + delay + 0.03
    const duration = life * 0.82
    const peak = start + duration * 0.4
    // Two slightly detuned voices sing through the vowel, hollow, a breath hisses through it and a sine underneath gives it a body.
    const formants = vowels.closed.map((frequency, formant) => {
      const filter = new BiquadFilterNode(context, {
        type: 'bandpass',
        frequency,
        Q: formant === 0 ? 5 : 7,
      })
      filter.frequency.setValueAtTime(frequency, start)
      filter.frequency.exponentialRampToValueAtTime(vowels.open[formant], peak)
      filter.frequency.exponentialRampToValueAtTime(frequency * 0.95, start + duration)
      return filter
    })
    const voice = new GainNode(context, {gain: 1})
    const upper = new GainNode(context, {gain: 0.55})
    formants[0].connect(voice)
    formants[1].connect(upper).connect(voice)
    nodes.push(...formants, upper, voice)
    for (const [type, detune, level] of [['sawtooth', -6, 1], ['sawtooth', 7, 1], ['sine', 0, 0.12]] as const) {
      const oscillator = new OscillatorNode(context, {
        type,
        detune,
        frequency: pitch * 0.8,
      })
      oscillator.frequency.setValueAtTime(pitch * 0.8, start)
      oscillator.frequency.exponentialRampToValueAtTime(pitch * 1.22, peak)
      oscillator.frequency.exponentialRampToValueAtTime(pitch * 0.62, start + duration)
      tremble(oscillator.frequency, start, duration, 5.2 + index * 0.17, pitch * 0.022)
      const share = new GainNode(context, {gain: level})
      oscillator.connect(share)
      if (type === 'sine') {
        share.connect(voice)
      } else {
        for (const formant of formants) {
          share.connect(formant)
        }
      }
      nodes.push(oscillator, share)
      oscillator.start(start)
      oscillator.stop(start + duration + 0.02)
    }
    const breath = new AudioBufferSourceNode(context, {buffer: whiteNoise(context)})
    const breathing = new GainNode(context, {gain: 0.3})
    breath.connect(breathing).connect(formants[1])
    nodes.push(breath, breathing)
    breath.start(start, Math.random() * 3)
    breath.stop(start + duration + 0.02)
    // It swells to its height, eases off a little and dies away.
    const envelope = new GainNode(context, {gain: 0})
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(0.06, start + duration * 0.35)
    envelope.gain.setTargetAtTime(0.042, start + duration * 0.45, duration * 0.15)
    envelope.gain.exponentialRampToValueAtTime(silence, start + duration)
    voice.connect(envelope).connect(bus)
    nodes.push(envelope)
    end = Math.max(end, start + duration)
  }
  // The theremin: a pure tone quavering widely, gliding up and sinking away.
  const theremin = new OscillatorNode(context, {frequency: 660})
  theremin.frequency.setValueAtTime(660, now + 0.1)
  theremin.frequency.exponentialRampToValueAtTime(1050, now + 0.1 + flight * 0.4)
  theremin.frequency.exponentialRampToValueAtTime(590, now + 0.1 + flight * 1.1)
  tremble(theremin.frequency, now + 0.1, flight * 1.1, 6.3, 16)
  play(theremin, theremin, now + 0.1, flight * 1.1, 0.016, flight * 0.3)
  nodes.push(theremin)
  // A tritone, each tone doubled a little higher, so the two beat like a held breath.
  for (const frequency of [207.65, 208.9, 293.66, 295.1]) {
    const tone = new OscillatorNode(context, {frequency})
    play(tone, tone, now, flight + 0.8, 0.011, flight * 0.35)
    nodes.push(tone)
  }
  // A cold draft rises with them, and the portal exhales them with a dark puff.
  const draft = new AudioBufferSourceNode(context, {buffer: whiteNoise(context)})
  const draftFilter = new BiquadFilterNode(context, {
    type: 'bandpass',
    frequency: 380,
    Q: 1.6,
  })
  draftFilter.frequency.setValueAtTime(380, now)
  draftFilter.frequency.exponentialRampToValueAtTime(2200, now + flight)
  draft.connect(draftFilter)
  play(draft, draftFilter, now, flight * 1.05, 0.035, flight * 0.3)
  const puff = new AudioBufferSourceNode(context, {buffer: whiteNoise(context)})
  const puffFilter = new BiquadFilterNode(context, {
    type: 'lowpass',
    frequency: 900,
  })
  puffFilter.frequency.setValueAtTime(900, now)
  puffFilter.frequency.exponentialRampToValueAtTime(160, now + 0.9)
  puff.connect(puffFilter)
  play(puff, puffFilter, now, 0.9, 0.08, 0.05)
  nodes.push(draft, draftFilter, puff, puffFilter)
  // Once everything has rung out in the hall, the nodes go.
  atContextTime(context, end + 4, () => {
    for (const node of nodes) {
      node.disconnect()
    }
  })
}

/** A cold, dark hall for the wails to ring in: three and a half seconds of decaying stereo noise, darkening fast. */
function hall(context: BaseAudioContext) {
  let buffer = impulses.get(context)
  if (!buffer) {
    const length = Math.ceil(context.sampleRate * 3.5)
    buffer = context.createBuffer(2, length, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let smooth = 0
      for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate
        smooth += (Math.random() * 2 - 1 - smooth) * Math.max(0.02, 0.5 - t * 0.3)
        data[i] = smooth * Math.exp(-t / 0.9) * (t < 0.03 ? 0 : 1)
      }
    }
    impulses.set(context, buffer)
  }
  return buffer
}
