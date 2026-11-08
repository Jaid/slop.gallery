import type {AudioOutput} from '../../proceduralAudio.ts'
import type {Range} from './noise.ts'

import atContextTime from '../../atContextTime.ts'
import {loopLength, swayCurve, whiteNoise} from './noise.ts'

/** a looping noise bed through one filter, its level swaying by smooth random modulation */
export type NoiseBed = {
  /** how fast (per second) and how far up (in cents) the filter’s frequency wanders along a smooth random curve, so a narrow band moves like wind instead of standing like a whistle */
  drift?: readonly [rate: number, cents: number]
  filter: BiquadFilterType
  frequency: number
  q?: number
  /** how many identical filters the noise passes in a row, each one steepening the slope by 12 dB per octave */
  stages?: number
  /** how fast (per second) and how deep (0–1) the level sways */
  sway?: readonly [rate: number, depth: number]
  volume: number
}
/** a held tone, optionally doubled a few hertz higher so the two beat against each other, its level swaying like a {@link NoiseBed}’s */
export type ToneBed = {
  /** how many hertz above `frequency` a second oscillator plays */
  beat?: number
  frequency: number
  sway?: readonly [rate: number, depth: number]
  type?: OscillatorType
  volume: number
}
/** how a {@link AmbienceLoop.swell} sounds besides its pitch */
export type SwellOptions = {
  /** seconds it takes to rise to full volume, by default a third of the swell */
  attack?: number
  /** the pitch it glides to by its end */
  endFrequency?: number
  type?: OscillatorType
  /** how fast (per second) and how far (in hertz) the pitch wavers */
  vibrato?: readonly [rate: number, depth: number]
}
export type AmbienceLoopOptions = {
  /** overall level */
  gain?: number
  id: string
  title: string
}
type Graph = {
  bus: GainNode
  context: BaseAudioContext
  level: GainNode
  /** the last node before the output, which stopping disconnects */
  outlet: AudioNode
  scheduledUntil: number
  sources: Set<AudioScheduledSourceNode>
  timer: ReturnType<typeof setInterval>
}
type EnvelopeOptions = {
  attack?: number
  /** where in its buffer a buffer source starts */
  offset?: number
  /** the node the source reaches the envelope through, such as a filter */
  through?: AudioNode
}

/** how far ahead one-shots are scheduled, in seconds */
const lookahead = 0.25
const scheduleInterval = 80
const silence = 0.00001

/**
 * An endlessly looping ambient sound, synthesized live with Web Audio: subclasses declare looping {@link NoiseBed}s and held {@link ToneBed}s and scatter one-shots like {@link chirp}, {@link burst} and {@link swell} over each scheduling window.
 * Constructing one makes no sound; {@link start} builds its graph on an output, where it sounds centered unless a subclass routes it elsewhere, like an `AmbienceEmitter` through a panner.
 */
export default abstract class AmbienceLoop {
  readonly gain: number
  readonly id: string
  readonly title: string
  private graph?: Graph
  private level = 1

  constructor({id, title, gain = 1}: AmbienceLoopOptions) {
    this.id = id
    this.title = title
    this.gain = gain
  }

  /** the looping beds, read whenever the loop starts */
  protected get beds(): ReadonlyArray<NoiseBed> {
    return []
  }

  get playing() {
    return Boolean(this.graph)
  }

  /** the held tones, read whenever the loop starts */
  protected get tones(): ReadonlyArray<ToneBed> {
    return []
  }

  /** A short burst of band-passed noise; a longer `attack` blows it in softly, like a breath. */
  protected burst(start: number, duration: number, volume: number, frequency: number, q = 1, attack?: number) {
    const graph = this.graph!
    const source = graph.context.createBufferSource()
    source.buffer = whiteNoise(graph.context)
    const filter = new BiquadFilterNode(graph.context, {
      type: 'bandpass',
      frequency,
      Q: q,
    })
    source.connect(filter)
    this.envelope(graph, source, start, duration, volume, {
      attack,
      offset: Math.random() * (loopLength - duration),
      through: filter,
    })
  }

  /** A sine sweeping from `frequency` to `endFrequency` as it decays. */
  protected chirp(start: number, duration: number, volume: number, frequency: number, endFrequency = frequency) {
    const graph = this.graph!
    const oscillator = graph.context.createOscillator()
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    this.envelope(graph, oscillator, start, duration, volume)
  }

  /** Connects the loop’s level to the output, returning the last node before it. A plain loop goes straight through, centered. */
  protected route(level: GainNode, _context: BaseAudioContext): AudioNode {
    return level
  }

  /** Random event times averaging `rate` per second within `from`–`until`. A Poisson process has no memory, so consecutive windows need no shared state. */
  protected *scatter(rate: number, from: number, until: number) {
    for (let time = from - Math.log(1 - Math.random()) / rate; time < until; time -= Math.log(1 - Math.random()) / rate) {
      yield time
    }
  }

  /** Schedules the one-shots that fall within `from`–`until`; the default loop has only beds. A window may start later than the last one ended, when timers were held back. */
  protected schedule(_from: number, _until: number) {}

  /** How loud the loop sounds, 0–1 of its {@link gain}, approaching it with `smoothing` as its time constant in seconds. Kept while stopped, for the next start. */
  setLevel(level: number, smoothing = 0.3) {
    this.level = level
    this.graph?.level.gain.setTargetAtTime(this.gain * level, this.graph.context.currentTime, smoothing)
  }

  /** Starts sounding on `output`, rising with `smoothing` as its time constant in seconds, or at once at 0; does nothing while already playing. */
  start(output: AudioOutput, smoothing = 0.2) {
    if (this.graph) {
      return
    }
    const {context, master} = output
    const level = new GainNode(context, {gain: this.gain * this.level})
    const bus = new GainNode(context, {gain: 0})
    bus.gain.setTargetAtTime(1, context.currentTime, smoothing)
    bus.connect(level)
    const outlet = this.route(level, context)
    outlet.connect(master)
    const graph: Graph = {
      bus,
      context,
      level,
      outlet,
      scheduledUntil: context.currentTime,
      sources: new Set,
      timer: setInterval(() => this.tick(graph), scheduleInterval),
    }
    this.graph = graph
    for (const bed of this.beds) {
      this.loopBed(graph, bed)
    }
    for (const tone of this.tones) {
      this.holdTone(graph, tone)
    }
    this.tick(graph)
  }

  /** Fades out and releases every node. */
  stop(fade = 0.1) {
    const {graph} = this
    if (!graph) {
      return
    }
    this.graph = undefined
    clearInterval(graph.timer)
    const now = graph.context.currentTime
    graph.bus.gain.cancelScheduledValues(now)
    graph.bus.gain.setTargetAtTime(0, now, fade / 4)
    for (const source of graph.sources) {
      source.stop(now + fade)
    }
    atContextTime(graph.context, now + fade + lookahead + 0.1, () => graph.outlet.disconnect())
  }

  /** A voice that rises slowly and dies away while gliding from `frequency` to its `endFrequency`, like a moan or a hoot. */
  protected swell(start: number, duration: number, volume: number, frequency: number, {attack = duration / 3, endFrequency = frequency, type = 'sine', vibrato}: SwellOptions = {}) {
    const graph = this.graph!
    const oscillator = new OscillatorNode(graph.context, {type})
    oscillator.frequency.setValueAtTime(frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration)
    if (vibrato) {
      const [rate, depth] = vibrato
      const wobble = new OscillatorNode(graph.context, {frequency: rate})
      const amount = new GainNode(graph.context, {gain: depth})
      wobble.connect(amount).connect(oscillator.frequency)
      wobble.addEventListener('ended', () => {
        wobble.disconnect()
        amount.disconnect()
      }, {once: true})
      wobble.start(start)
      wobble.stop(start + duration + 0.01)
    }
    this.envelope(graph, oscillator, start, duration, volume, {attack})
  }

  /** a random value within `range` */
  protected vary(range: Range) {
    return range[0] + Math.random() * (range[1] - range[0])
  }

  private envelope(graph: Graph, source: AudioScheduledSourceNode, start: number, duration: number, volume: number, {attack = 0.004, offset, through = source}: EnvelopeOptions = {}) {
    const envelope = graph.context.createGain()
    envelope.gain.value = 0
    envelope.gain.setValueAtTime(0, start)
    // capped so ticks shorter than the attack still decay instead of the fade-out being scheduled before the fade-in
    const rise = Math.min(attack, duration * 0.8)
    envelope.gain.linearRampToValueAtTime(volume, start + rise)
    envelope.gain.exponentialRampToValueAtTime(silence, start + duration)
    through.connect(envelope).connect(graph.bus)
    source.addEventListener('ended', () => {
      source.disconnect()
      through.disconnect()
      envelope.disconnect()
    }, {once: true})
    if (source instanceof AudioBufferSourceNode) {
      source.start(start, offset)
    } else {
      source.start(start)
    }
    source.stop(start + duration + 0.01)
  }

  private holdTone(graph: Graph, tone: ToneBed) {
    const level = this.swayingLevel(graph, tone.volume, tone.sway)
    level.connect(graph.bus)
    for (const frequency of tone.beat ? [tone.frequency, tone.frequency + tone.beat] : [tone.frequency]) {
      const oscillator = new OscillatorNode(graph.context, {
        type: tone.type ?? 'sine',
        frequency,
      })
      oscillator.connect(level)
      oscillator.start()
      graph.sources.add(oscillator)
    }
  }

  private loopBed(graph: Graph, bed: NoiseBed) {
    const {context} = graph
    const source = context.createBufferSource()
    source.buffer = whiteNoise(context)
    source.loop = true
    const filters = Array.from({length: bed.stages ?? 1}, () => new BiquadFilterNode(context, {
      type: bed.filter,
      frequency: bed.frequency,
      Q: bed.q ?? 0.7,
    }))
    const level = this.swayingLevel(graph, bed.volume, bed.sway)
    let tail: AudioNode = source
    for (const filter of filters) {
      tail = tail.connect(filter)
    }
    if (bed.drift) {
      const [rate, cents] = bed.drift
      const drift = context.createBufferSource()
      drift.buffer = swayCurve(context, rate)
      drift.loop = true
      const range = new GainNode(context, {gain: cents})
      drift.connect(range)
      for (const filter of filters) {
        range.connect(filter.detune)
      }
      drift.start(0, Math.random() * loopLength)
      graph.sources.add(drift)
    }
    tail.connect(level).connect(graph.bus)
    // Every bed starts somewhere else in the shared noise, so beds never move in lockstep.
    source.start(0, Math.random() * loopLength)
    graph.sources.add(source)
  }

  /** A gain at `volume`, swaying down by up to `depth` of it along a smooth random curve. */
  private swayingLevel(graph: Graph, volume: number, [rate, depth] = [0, 0] as readonly [number, number]) {
    const level = new GainNode(graph.context, {gain: volume * (1 - depth)})
    if (depth) {
      const sway = graph.context.createBufferSource()
      sway.buffer = swayCurve(graph.context, rate)
      sway.loop = true
      sway.connect(new GainNode(graph.context, {gain: volume * depth})).connect(level.gain)
      sway.start()
      graph.sources.add(sway)
    }
    return level
  }

  private tick(graph: Graph) {
    const now = graph.context.currentTime
    const until = now + lookahead
    if (until > graph.scheduledUntil) {
      this.schedule(Math.max(graph.scheduledUntil, now), until)
      graph.scheduledUntil = until
    }
  }
}
