import {afterEach, beforeEach, expect, test} from 'bun:test'

import {audioBuffer} from '../src/browser.ts'
import {AudioQueue} from '../src/core.ts'
import {flush} from './helpers.ts'

/** a node of the fake graph, which remembers what it is connected to */
class Node extends EventTarget {
  connections: Array<unknown> = []
  disconnects = 0
  connect(target: unknown) {
    this.connections.push(target)
    return target
  }
  disconnect() {
    this.disconnects++
    this.connections = []
  }
}
class Gain extends Node {
  gain: {value: number}
  constructor(_context: unknown, {gain}: {gain: number}) {
    super()
    this.gain = {value: gain}
  }
}
class Source extends Node {
  static instances: Array<Source> = []
  started?: [when: number, offset: number]
  stops = 0
  constructor(_context: unknown, readonly options: {buffer: {duration: number}}) {
    super()
    Source.instances.push(this)
  }
  /** ends as the context would once the recording ran out */
  end() {
    this.dispatchEvent(new Event('ended'))
  }
  start(when: number, offset: number) {
    this.started = [when, offset]
  }
  stop() {
    this.stops++
    this.dispatchEvent(new Event('ended'))
  }
}
const original = {
  AudioBufferSourceNode: globalThis.AudioBufferSourceNode,
  GainNode: globalThis.GainNode,
}
const fakeContext = () => {
  const decoded: Array<ArrayBuffer> = []
  return {
    currentTime: 0,
    destination: new Node,
    decoded,
    decodeAudioData: async (bytes: ArrayBuffer) => {
      decoded.push(bytes)
      return {duration: 3}
    },
  }
}
let queue: AudioQueue
beforeEach(() => {
  Source.instances = []
  Object.assign(globalThis, {
    AudioBufferSourceNode: Source,
    GainNode: Gain,
  })
  queue = new AudioQueue
})
afterEach(() => {
  queue.dispose()
  Object.assign(globalThis, original)
})
test('a decoded recording plays from the context’s clock at its volume, pauses where it stood and resumes there', async () => {
  const context = fakeContext()
  const outputs: Array<Gain> = []
  let disconnected = 0
  const disconnect = () => {
    disconnected++
  }
  const handle = queue.push(audioBuffer(new Blob(['audio']), {
    context: context as unknown as BaseAudioContext,
    volume: 0.85,
    connect: output => {
      outputs.push(output as unknown as Gain)
      return disconnect
    },
  }))
  await flush()
  expect(context.decoded).toHaveLength(1)
  expect(outputs).toHaveLength(1)
  expect(outputs[0].gain.value).toBe(0.85)
  const [first] = Source.instances
  expect(first.connections).toEqual([outputs[0]])
  expect(first.started).toEqual([0, 0])
  context.currentTime = 1.25
  expect(queue.progress(handle.id)).toEqual({
    seconds: 1.25,
    duration: 3,
  })
  // An injection pauses it; its stop is no end.
  queue.push(audioBuffer(new Blob(['other']), {context: context as unknown as BaseAudioContext}), {priority: 'inject'})
  await flush()
  expect(first.stops).toBe(1)
  expect(queue.progress(handle.id)).toEqual({
    seconds: 1.25,
    duration: 3,
  })
  context.currentTime = 2
  Source.instances[1].end()
  await flush()
  const resumed = Source.instances[2]
  expect(resumed.started).toEqual([2, 1.25])
  context.currentTime = 3.5
  expect(queue.progress(handle.id)).toEqual({
    seconds: 2.75,
    duration: 3,
  })
  resumed.end()
  expect(await handle.finished).toEqual({status: 'completed'})
  expect(disconnected).toBe(1)
  expect(outputs[0].disconnects).toBe(1)
})
test('without a connection a decoded recording plays into the context’s destination, and cancellation stops it once', async () => {
  const context = fakeContext()
  const handle = queue.push(audioBuffer(new Blob(['audio']), {context: context as unknown as BaseAudioContext}))
  await flush()
  const [source] = Source.instances
  const [output] = source.connections as Array<Gain>
  expect(output.connections).toEqual([context.destination])
  handle.cancel()
  expect(await handle.finished).toMatchObject({status: 'cancelled'})
  expect(source.stops).toBe(1)
  expect(output.disconnects).toBe(1)
})
test('a recording that can’t be fetched fails without playing anything', async () => {
  const context = fakeContext()
  const fetching = globalThis.fetch
  globalThis.fetch = (async () => new Response(null, {status: 404})) as unknown as typeof fetch
  try {
    const handle = queue.push(audioBuffer('/missing.opus', {context: context as unknown as BaseAudioContext}))
    const result = await handle.finished
    expect(result.status).toBe('failed')
    expect(Source.instances).toHaveLength(0)
  } finally {
    globalThis.fetch = fetching
  }
})
