import type {Reverberation} from '../../src/lib/audio/transformers/reverberation.ts'
import type {SoundTransformer} from '../../src/lib/audio/transformers/TransformerChain.ts'

import {expect, mock, test} from 'bun:test'

import {reverberationImpulse} from '../../src/lib/audio/transformers/reverberation.ts'
import TransformerChain from '../../src/lib/audio/transformers/TransformerChain.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'
import audioFixture from './audioFixture.ts'

/** A chain on the fixture’s context, with the timers on its clock that release transformers rung out, which end when told to, and its links’ gains. */
function setup() {
  const fixture = audioFixture()
  const scheduled = {
    get length() {
      return fixture.timers.length
    },
    /** ends the timer started `index`th, as the context’s clock reaching it would */
    end: (index: number) => fixture.timers[index].dispatchEvent(new Event('ended')),
    /** the context time the timer started `index`th is due at, as last scheduled */
    at: (index: number) => fixture.timers[index].stop.mock.calls[0][0],
  }
  const [input, output] = [fixture.context.createGain(), fixture.context.createGain()]
  const context = fixture.context as unknown as BaseAudioContext
  const chain = new TransformerChain(context, input as unknown as AudioNode, output as unknown as AudioNode)
  const links = Array.from({length: 6}, (_, index) => {
    const [dry, send, outlet] = fixture.gains.slice(2 + index * 3, 5 + index * 3)
    return {
      dry,
      send,
      outlet,
    }
  })
  return {
    ...fixture,
    chain,
    input,
    links,
    output,
    scheduled,
  }
}
const transformer = () => {
  const release = mock(() => {})
  const transform = mock(((_context, input, output) => {
    input.connect(output)
    return release
  }) satisfies SoundTransformer)
  return {
    release,
    transform,
  }
}
test('the world passes dry through every link until a transformer takes some of it', () => {
  const {gains, input, links, output} = setup()
  expect(gains).toHaveLength(2 + 6 * 3)
  let inlet = input
  for (const {dry, send, outlet} of links) {
    expect(inlet.connect).toHaveBeenCalledWith(dry)
    expect(inlet.connect).toHaveBeenCalledWith(send)
    expect(dry.connect).toHaveBeenCalledWith(outlet)
    expect(dry.gain.value).toBe(1)
    expect(send.gain.value).toBe(0)
    expect(send.connect).not.toHaveBeenCalled()
    inlet = outlet
  }
  expect(inlet.connect).toHaveBeenCalledWith(output)
})
test('a transformer is built once, takes its share of the sound and leaves the rest dry, and a second one stacks after it', () => {
  const {chain, context, links} = setup()
  const lobby = transformer()
  const key = {}
  chain.transform(key, lobby.transform, 0)
  expect(lobby.transform).not.toHaveBeenCalled()
  context.currentTime = 2
  chain.transform(key, lobby.transform, 0.25)
  chain.transform(key, lobby.transform, 0.25)
  expect(lobby.transform).toHaveBeenCalledTimes(1)
  expect(lobby.transform).toHaveBeenCalledWith(context, links[0].send, links[0].outlet)
  expect(links[0].send.gain.setTargetAtTime).toHaveBeenCalledTimes(1)
  expect(links[0].send.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.25, 2, 0.03)
  expect(links[0].dry.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.75, 2, 0.03)
  chain.transform(key, lobby.transform, 1)
  expect(links[0].send.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 2, 0.03)
  expect(links[0].dry.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.03)
  const orb = transformer()
  chain.transform({}, orb.transform, 0.5)
  expect(orb.transform).toHaveBeenCalledWith(context, links[1].send, links[1].outlet)
  // Without smoothing, as under ?fade=false, the share switches at once.
  chain.transform(key, lobby.transform, 0, 0)
  expect(links[0].send.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0)
  expect(links[0].dry.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 2, 0)
})
test('a transformer that stops taking any sound rings out and is released later, unless it takes some again before', () => {
  const {chain, links, scheduled} = setup()
  const lobby = transformer()
  const vesper = transformer()
  const [lobbyKey, vesperKey] = [{}, {}]
  chain.transform(lobbyKey, lobby.transform, 1)
  chain.transform(lobbyKey, lobby.transform, 0)
  chain.transform(vesperKey, vesper.transform, 1)
  expect(links[0].send.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.03)
  expect(lobby.release).not.toHaveBeenCalled()
  // Back through the doorway, the Lobby’s transformer is still there.
  chain.transform(lobbyKey, lobby.transform, 1)
  expect(lobby.transform).toHaveBeenCalledTimes(1)
  chain.transform(vesperKey, vesper.transform, 0)
  expect(scheduled).toHaveLength(2)
  // Both ring out for 8 s of the context’s own time.
  expect(scheduled.at(1)).toBe(8)
  // The Lobby’s timer was canceled by stepping back in, so its end releases nothing; the Vesper’s releases it.
  scheduled.end(0)
  expect(lobby.release).not.toHaveBeenCalled()
  scheduled.end(1)
  expect(vesper.release).toHaveBeenCalledTimes(1)
  expect(links[1].send.disconnect).toHaveBeenCalledTimes(1)
  expect(lobby.release).not.toHaveBeenCalled()
  // Taking sound anew builds it anew, on the link it left free.
  chain.transform(vesperKey, vesper.transform, 0.5)
  expect(vesper.transform).toHaveBeenCalledTimes(2)
  expect(vesper.transform).toHaveBeenLastCalledWith(expect.anything(), links[1].send, links[1].outlet)
})
test('with every link taken, a new transformer replaces the one that has rung out the longest, or else stays out', () => {
  const {chain, context, links} = setup()
  const transformers = Array.from({length: 6}, () => ({
    key: {},
    ...transformer(),
  }))
  for (const [index, {key, transform}] of transformers.entries()) {
    chain.transform(key, transform, 1)
    context.currentTime = 6 - index
    chain.transform(key, transform, 0)
  }
  const late = transformer()
  chain.transform({}, late.transform, 1)
  // The last one stopped taking any sound first.
  expect(transformers[5].release).toHaveBeenCalledTimes(1)
  expect(late.transform).toHaveBeenCalledWith(expect.anything(), links[5].send, links[5].outlet)
  for (const {key, transform} of transformers.slice(0, 5)) {
    chain.transform(key, transform, 1)
  }
  const crowded = transformer()
  chain.transform({}, crowded.transform, 1)
  expect(crowded.transform).not.toHaveBeenCalled()
})
/** a context that only makes buffers, a channel of its own each */
const bufferContext = () => ({
  sampleRate: 48_000,
  createBuffer(channels: number, length: number) {
    const data = Array.from({length: channels}, () => new Float32Array(length))
    return {
      length,
      numberOfChannels: channels,
      getChannelData: (channel: number) => data[channel],
    }
  },
}) as unknown as BaseAudioContext
const hall: Reverberation = {
  decay: 2,
  predelay: 0.02,
  brightness: [8000, 2000],
  early: [[0.01, 0.4]],
  flutter: [0.02, 3, 0.3],
  wet: 0.2,
}
test('a reverberation’s impulse rings for its decay after its predelay at unit energy, the same every time, made once per context', () => {
  const context = bufferContext()
  const impulse = reverberationImpulse(context, hall)
  expect(reverberationImpulse(context, hall)).toBe(impulse)
  expect(impulse.length).toBe(Math.ceil((0.02 + 2 * 1.1) * 48_000))
  const [left, right] = [impulse.getChannelData(0), impulse.getChannelData(1)]
  expect(left.subarray(0, 0.02 * 48_000).every(sample => sample === 0)).toBe(true)
  let energy = 0
  for (const data of [left, right]) {
    for (const sample of data) {
      expect(Number.isFinite(sample)).toBe(true)
      energy += sample * sample
    }
  }
  expect(energy / 2).toBeCloseTo(1, 4)
  // The two channels differ, which widens the room.
  expect(left).not.toEqual(right)
  // The tail has died by 60 dB at the decay time.
  const level = (data: Float32Array, from: number) => Math.max(...data.subarray(from * 48_000, (from + 0.1) * 48_000).map(Math.abs))
  expect(level(left, 2.02) / level(left, 0.1)).toBeLessThan(0.002)
  const again = reverberationImpulse(bufferContext(), hall)
  expect(again).not.toBe(impulse)
  expect(again.getChannelData(0)).toEqual(left)
})
test('every room of every world has a mood of its own with acoustics, and no two rooms share a mood’s id', () => {
  for (const world of [slopGallery, knottingham, sandbox]) {
    const ids = world.rooms.flatMap(placed => placed.moods.map(mood => mood.id))
    const distinct = new Set(ids)
    expect(distinct.size).toBe(ids.length)
    for (const placed of world.rooms) {
      expect(`${placed.id}: ${placed.moods.filter(mood => typeof mood.transformer === 'function').length}`).toBe(`${placed.id}: 1`)
    }
  }
})
