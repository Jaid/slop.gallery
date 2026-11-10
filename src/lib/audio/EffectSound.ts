import type {Vec3} from '../gallery/types.ts'
import type {AudioOutput} from 'procedural-audio'

import {atContextTime, whiteNoise} from 'procedural-audio'

const silence = 0.0001

/** a filter something sounds through, which may glide exponentially to `end` hertz by the sound’s end */
export type SoundFilter = {
  end?: number
  frequency: number
  q?: number
  type: BiquadFilterType
}
/** how a sound swells and dies: it rises to `volume` over `attack` seconds, holds it for `hold` seconds and falls exponentially to silence by its end */
export type SoundShape = {
  attack?: number
  hold?: number
  volume: number
}
export type SoundTone = SoundShape & {
  /** how far it is tuned off its frequency, in cents */
  detune?: number
  /** the frequency it glides to by its end, exponentially */
  end?: number
  filter?: SoundFilter
  frequency: number
  type?: OscillatorType
  /** a vibrato: how many hertz it swings and how many times a second */
  vibrato?: readonly [depth: number, rate: number]
}
export type SoundHiss = SoundShape & {
  filter: SoundFilter
}
/** the space an effect’s sound rings in: how long its echo lasts, in seconds, how fast it dies and darkens and how loud it is */
export type SoundRoom = {
  /** how far the echo’s noise is smoothed at its start, 0–1; lower is darker */
  brightness: number
  /** seconds the echo takes to fall by about two thirds */
  decay: number
  length: number
  wet: number
}

const impulses = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>
/** The echo of a room: decaying stereo noise, smoothed ever more as it goes, so its tail darkens, shared by every sound of a context that rings in the same room. */
function echo(context: BaseAudioContext, {brightness, decay, length}: SoundRoom) {
  let rooms = impulses.get(context)
  if (!rooms) {
    rooms = new Map
    impulses.set(context, rooms)
  }
  const key = `${brightness}:${decay}:${length}`
  let buffer = rooms.get(key)
  if (!buffer) {
    const frames = Math.ceil(context.sampleRate * length)
    buffer = context.createBuffer(2, frames, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let smooth = 0
      for (let i = 0; i < frames; i++) {
        const t = i / context.sampleRate
        smooth += (Math.random() * 2 - 1 - smooth) * Math.max(0.02, brightness - t / length * brightness * 0.8)
        data[i] = smooth * Math.exp(-t / decay) * (t < 0.02 ? 0 : 1)
      }
    }
    rooms.set(key, buffer)
  }
  return buffer
}

/**
 * The sound of something an effect lets out of a fusion’s portal, synthesized from now on and heard through an HRTF panner at a point that may glide along with what makes the sound, all ringing in a room of its own.
 * It owns every node it makes and disconnects them once {@link finish} found them rung out, so the portal closing doesn’t cut its tail off.
 */
export default class EffectSound {
  /** what its parts sound into by default, heard from where it is and ringing in its room; a part heard from somewhere else can feed it some of itself, so it rings in the room too */
  readonly bus: GainNode
  readonly context: BaseAudioContext
  /** when it started, in the context’s seconds */
  readonly now: number
  /** when the last of its parts ends, in the context’s seconds */
  private end: number
  private readonly master: AudioNode
  private readonly nodes: Array<AudioNode> = []
  private readonly panner: PannerNode

  constructor({context, master}: AudioOutput, [x, y, z]: Vec3, room: SoundRoom) {
    this.context = context
    this.master = master
    this.now = context.currentTime
    this.end = this.now
    this.panner = this.pannerAt([x, y, z], 'HRTF')
    this.bus = this.keep(new GainNode(context, {gain: 1}))
    this.bus.connect(this.panner)
    const reverb = this.keep(new ConvolverNode(context, {buffer: echo(context, room)}))
    const wet = this.keep(new GainNode(context, {gain: room.wet}))
    this.bus.connect(reverb).connect(wet).connect(this.panner)
  }

  /** An envelope at `start` lasting `duration` seconds, into `into`, the bus by default, which `through` sounds through. */
  envelope(through: AudioNode, start: number, duration: number, {attack = 0.004, hold = 0, volume}: SoundShape, into: AudioNode = this.bus) {
    const envelope = this.keep(new GainNode(this.context, {gain: 0}))
    const peak = start + Math.min(attack, duration * 0.9)
    envelope.gain.setValueAtTime(0, start)
    envelope.gain.linearRampToValueAtTime(volume, peak)
    envelope.gain.setValueAtTime(volume, Math.min(peak + hold, start + duration * 0.95))
    envelope.gain.exponentialRampToValueAtTime(silence, start + duration)
    envelope.gain.setValueAtTime(0, start + duration)
    through.connect(envelope).connect(into)
    this.end = Math.max(this.end, start + duration)
  }

  /** Disconnects every node once everything has rung out, `tail` seconds after the last part ended. */
  finish(tail = 3) {
    atContextTime(this.context, this.end + tail, () => {
      for (const node of this.nodes) {
        node.disconnect()
      }
    })
  }

  /** Moves where it is heard from to `to`, gliding there linearly by `at`, in the context’s seconds. */
  glide(to: Vec3, at: number) {
    const {positionX, positionY, positionZ} = this.panner
    for (const [index, position] of [positionX, positionY, positionZ].entries()) {
      position.linearRampToValueAtTime(to[index], at)
    }
  }

  /** Noise through a filter from `start` for `duration` seconds, into `into`, the bus by default. */
  hiss(start: number, duration: number, {filter, ...shape}: SoundHiss, into?: AudioNode) {
    const source = this.keep(new AudioBufferSourceNode(this.context, {buffer: whiteNoise(this.context)}))
    const filtered = this.filter(filter, start, duration)
    source.connect(filtered)
    this.envelope(filtered, start, duration, shape, into)
    source.start(start, Math.random() * 3)
    source.stop(start + duration + 0.02)
  }

  /** Registers nodes it made for something of its own, which {@link finish} disconnects with the rest. */
  keep<Node extends AudioNode>(node: Node) {
    this.nodes.push(node)
    return node
  }

  /** A panner of its own at `position`, into the master, for a part heard from somewhere else, like one of many bats; equal-power by default, which costs next to nothing. */
  pannerAt([x, y, z]: Vec3, panningModel: PanningModelType = 'equalpower') {
    const panner = this.keep(new PannerNode(this.context, {
      panningModel,
      distanceModel: 'linear',
      refDistance: 2.5,
      maxDistance: 28,
      rolloffFactor: 1,
      positionX: x,
      positionY: y,
      positionZ: z,
    }))
    for (const [index, position] of [panner.positionX, panner.positionY, panner.positionZ].entries()) {
      position.setValueAtTime([x, y, z][index], this.now)
    }
    panner.connect(this.master)
    return panner
  }

  /** A tone from `start` for `duration` seconds, into `into`, the bus by default. */
  tone(start: number, duration: number, {detune = 0, end, filter, frequency, type = 'sine', vibrato, ...shape}: SoundTone, into?: AudioNode) {
    const oscillator = this.keep(new OscillatorNode(this.context, {
      type,
      frequency,
      detune,
    }))
    oscillator.frequency.setValueAtTime(frequency, start)
    if (end) {
      oscillator.frequency.exponentialRampToValueAtTime(end, start + duration)
    }
    if (vibrato) {
      const [depth, rate] = vibrato
      const wobble = this.keep(new OscillatorNode(this.context, {frequency: rate}))
      const amount = this.keep(new GainNode(this.context, {gain: depth}))
      wobble.connect(amount).connect(oscillator.frequency)
      wobble.start(start)
      wobble.stop(start + duration + 0.02)
    }
    const shaped = filter ? this.filter(filter, start, duration) : undefined
    if (shaped) {
      oscillator.connect(shaped)
    }
    this.envelope(shaped ?? oscillator, start, duration, shape, into)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
  }

  private filter({end, frequency, q = 1, type}: SoundFilter, start: number, duration: number) {
    const filter = this.keep(new BiquadFilterNode(this.context, {
      type,
      frequency,
      Q: q,
    }))
    filter.frequency.setValueAtTime(frequency, start)
    if (end) {
      filter.frequency.exponentialRampToValueAtTime(end, start + duration)
    }
    return filter
  }
}
