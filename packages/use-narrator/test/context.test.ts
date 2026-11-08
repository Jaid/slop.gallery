import {afterEach, beforeEach, expect, test} from 'bun:test'

import {flush} from '../packages/use-audio-queue/test/helpers.ts'
import {Narrator} from '../src/core.ts'

class Node extends EventTarget {
  connect(target: unknown) {
    return target
  }
  disconnect() {}
}
class Source extends Node {
  static instances: Array<Source> = []
  started = false
  constructor() {
    super()
    Source.instances.push(this)
  }
  start() {
    this.started = true
  }
  stop() {}
}
class Media extends EventTarget {
  static instances: Array<Media> = []
  paused = true
  volume = 1
  constructor(readonly src: string) {
    super()
    Media.instances.push(this)
  }
  load() {}
  pause() {
    this.paused = true
  }
  async play() {
    this.paused = false
  }
  removeAttribute() {}
}
const disconnectNothing = () => {}
const original = {
  Audio: globalThis.Audio,
  AudioBufferSourceNode: globalThis.AudioBufferSourceNode,
  GainNode: globalThis.GainNode,
}
beforeEach(() => {
  Source.instances = []
  Media.instances = []
  Object.assign(globalThis, {
    Audio: Media,
    AudioBufferSourceNode: Source,
    GainNode: Node,
  })
})
afterEach(() => {
  Object.assign(globalThis, original)
})
test('recordings play decoded through the context the audio options give, and through media elements while they give none', async () => {
  const context = {
    currentTime: 0,
    destination: new Node,
    decodeAudioData: async () => ({duration: 2}),
  } as unknown as BaseAudioContext
  let through: BaseAudioContext | undefined = context
  const connected: Array<[unknown, string]> = []
  using narrator = new Narrator({
    audio: {
      context: () => through,
      connect: (audio, instanceId) => {
        connected.push([audio, instanceId])
        return disconnectNothing
      },
    },
  })
  narrator.push({audio: new Blob(['voice'])})
  await flush()
  expect(Source.instances).toHaveLength(1)
  expect(Source.instances[0].started).toBe(true)
  expect(Media.instances).toHaveLength(0)
  const [[output, instanceId]] = connected
  expect(output).toBeInstanceOf(Node)
  expect(instanceId).toBe(narrator.getSnapshot().current!.metadata.instanceId)
  narrator.stop()
  await flush()
  through = undefined
  narrator.push({audio: '/voice.opus'})
  await flush()
  expect(Media.instances).toHaveLength(1)
  expect(connected[1][0]).toBe(Media.instances[0])
  expect(Source.instances).toHaveLength(1)
})
