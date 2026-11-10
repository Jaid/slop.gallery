import {mock} from 'bun:test'

const param = (value = 1) => ({
  value,
  setValueAtTime: mock((_value: number, _time: number) => {}),
  setTargetAtTime: mock((_value: number, _time: number, _constant: number) => {}),
  linearRampToValueAtTime: mock((_value: number, _time: number) => {}),
  exponentialRampToValueAtTime: mock((_value: number, _time: number) => {}),
  cancelAndHoldAtTime: mock((_time: number) => {}),
  cancelScheduledValues: mock((_time: number) => {}),
})
const node = () => ({
  connect: mock((target: unknown) => target),
  disconnect: mock(() => {}),
})
const source = () => Object.assign(new EventTarget, node(), {
  buffer: null,
  type: 'sine',
  frequency: param(440),
  detune: param(0),
  offset: param(),
  loop: false,
  start: mock((_time?: number, _offset?: number) => {}),
  stop: mock((_time?: number) => {}),
})

export type FakeGain = ReturnType<typeof node> & {gain: ReturnType<typeof param>}
export type FakeFilter = ReturnType<typeof node> & {
  context: unknown
  detune: ReturnType<typeof param>
  frequency: ReturnType<typeof param>
  Q: ReturnType<typeof param>
  type: string
}
export type FakePanner = ReturnType<typeof node> & {options: PannerOptions}
export type FakeSource = ReturnType<typeof source>

/**
 * An audio context that only keeps book: every node it makes, by its factories or by the node constructors, which it puts in place of the browser’s until `restore` is called.
 */
export default function audioFixture() {
  const gains: Array<FakeGain> = []
  const sources: Array<FakeSource> = []
  const filters: Array<FakeFilter> = []
  const panners: Array<FakePanner> = []
  const buffers: Array<Float32Array> = []
  /** the silent sources that time callbacks on the context’s clock, which tests end by dispatching `ended` */
  const timers: Array<FakeSource> = []
  // Filters know their context, which is only made after them.
  const holder: {context?: unknown} = {}
  const makeGain = (value = 1) => {
    const result = {
      ...node(),
      gain: param(value),
    }
    gains.push(result)
    return result
  }
  const makeFilter = (options: BiquadFilterOptions = {}) => {
    const result = {
      ...node(),
      get context() {
        return holder.context
      },
      frequency: param(options.frequency ?? 350),
      detune: param(0),
      Q: param(options.Q ?? 1),
      type: options.type ?? 'lowpass',
    }
    filters.push(result)
    return result
  }
  const makeSource = (options: {
    buffer?: unknown
    frequency?: number
    type?: string
  } = {}) => {
    const result = source()
    Object.assign(result, {buffer: options.buffer ?? null})
    result.type = options.type ?? 'sine'
    result.frequency.value = options.frequency ?? 440
    sources.push(result)
    return result
  }
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    listener: {
      positionX: param(0),
      positionY: param(0),
      positionZ: param(0),
    },
    createGain: () => makeGain(),
    createBiquadFilter: () => makeFilter(),
    createOscillator: () => makeSource(),
    createBufferSource: () => makeSource(),
    createConstantSource() {
      const result = source()
      timers.push(result)
      return result
    },
    createBuffer(_channels: number, length: number, _rate: number) {
      const data = new Float32Array(length)
      buffers.push(data)
      return {getChannelData: () => data}
    },
  }
  holder.context = context
  const globals = globalThis as unknown as Record<string, unknown>
  const constructors: Record<string, unknown> = {
    GainNode: function GainNode(_context: unknown, options: GainOptions = {}) {
      return makeGain(options.gain)
    },
    BiquadFilterNode: function BiquadFilterNode(_context: unknown, options?: BiquadFilterOptions) {
      return makeFilter(options)
    },
    OscillatorNode: function OscillatorNode(_context: unknown, options?: OscillatorOptions) {
      return makeSource(options)
    },
    // Nothing the fixture makes is an instance of it, like an oscillator in a browser.
    AudioBufferSourceNode: function AudioBufferSourceNode(_context: unknown, options?: AudioBufferSourceOptions) {
      return makeSource(options)
    },
    PannerNode: function PannerNode(_context: unknown, options: PannerOptions = {}) {
      const result = {
        ...node(),
        options,
      }
      panners.push(result)
      return result
    },
  }
  const saved = Object.fromEntries(Object.keys(constructors).map(name => [name, Object.getOwnPropertyDescriptor(globals, name)]))
  Object.assign(globals, constructors)
  return {
    context: context as typeof context & BaseAudioContext,
    destination: context.destination,
    gains,
    sources,
    filters,
    panners,
    buffers,
    timers,
    restore() {
      for (const [name, descriptor] of Object.entries(saved)) {
        if (descriptor) {
          Object.defineProperty(globals, name, descriptor)
        } else {
          Reflect.deleteProperty(globals, name)
        }
      }
    },
  }
}
