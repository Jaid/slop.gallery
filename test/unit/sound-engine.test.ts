import {afterEach, expect, mock, test} from 'bun:test'

import SoundEngine from '../../src/lib/audio/SoundEngine.ts'
import worldClock from '../../src/lib/worldClock.ts'
import audioFixture from './audioFixture.ts'

/** the gains the engine makes for itself: its master, its output, the world and the three of each of its transformer chain’s six links; every playback’s come after them */
const engineGains = 3 + 6 * 3
const noRelease = () => {}
const originalContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
afterEach(() => {
  if (originalContext) {
    Object.defineProperty(globalThis, 'AudioContext', originalContext)
  } else {
    Reflect.deleteProperty(globalThis, 'AudioContext')
  }
})
function setup() {
  const fixture = audioFixture()
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: class {
      constructor() {
        return fixture.context
      }
    },
  })
  return {
    ...fixture,
    sound: Reflect.construct(SoundEngine, []) as SoundEngine,
  }
}
test('effects retain their 12 dB boost and mute only schedules changes', () => {
  const {sound, context, gains} = setup()
  const [master, output] = gains
  expect(20 * Math.log10(master.gain.value / 0.6)).toBeCloseTo(12)
  expect(master.connect).toHaveBeenCalledWith(output)
  expect(output.gain.value).toBe(1)
  expect(output.connect).toHaveBeenCalledWith(context.destination)
  sound.mute(true)
  sound.mute(true)
  expect(master.gain.setTargetAtTime).toHaveBeenCalledTimes(1)
  expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.08)
  context.currentTime = 2
  sound.mute(false)
  expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(master.gain.value, 2, 0.08)
})
test('the engine falls silent with a frozen world and sounds on from where it stood once the world goes on', async () => {
  const {sound, context} = setup()
  // An engine that was never let to sound stays as the browser holds it.
  context.state = 'suspended'
  worldClock.freeze()()
  expect(context.suspend).toHaveBeenCalledTimes(1)
  expect(context.resume).not.toHaveBeenCalled()
  await sound.resume()
  expect(context.resume).toHaveBeenCalledTimes(1)
  context.state = 'running'
  const release = worldClock.freeze()
  try {
    expect(context.suspend).toHaveBeenCalledTimes(2)
    context.state = 'suspended'
    // Whatever asks it to sound during the pause, like the menu’s Resume button, has to wait for the world.
    await sound.resume()
    expect(context.resume).toHaveBeenCalledTimes(1)
  } finally {
    release()
  }
  expect(context.resume).toHaveBeenCalledTimes(2)
})
test('an engine the browser let sound right away sounds again after a pause, and one made during a pause waits for its end', async () => {
  const autoplaying = setup()
  const release = worldClock.freeze()
  let late: ReturnType<typeof setup>
  try {
    expect(autoplaying.context.suspend).toHaveBeenCalledTimes(1)
    late = setup()
    expect(late.context.suspend).toHaveBeenCalledTimes(1)
    late.context.state = 'suspended'
    await late.sound.resume()
    expect(late.context.resume).not.toHaveBeenCalled()
  } finally {
    release()
  }
  expect(autoplaying.context.resume).toHaveBeenCalledTimes(1)
  expect(late.context.resume).toHaveBeenCalledTimes(1)
})
test('switching the sound during a pause takes effect at once as the world goes on, without a fade', () => {
  const {sound, context, gains} = setup()
  const [master] = gains
  const full = master.gain.value
  context.currentTime = 3
  const release = worldClock.freeze()
  try {
    sound.mute(true)
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 3)
    sound.mute(false)
    expect(master.gain.setValueAtTime).toHaveBeenLastCalledWith(full, 3)
    expect(master.gain.setTargetAtTime).not.toHaveBeenCalled()
  } finally {
    release()
  }
  sound.mute(true)
  expect(master.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 3, 0.08)
})
test('catalog effects respect the SoundEngine mute state', () => {
  const {sound, sources} = setup()
  sound.playEffect('SFX-42')
  expect(sources.length).toBeGreaterThan(0)
  const count = sources.length
  sound.mute(true)
  sound.playEffect('SFX-43')
  expect(sources).toHaveLength(count)
})
test('stride callbacks at time zero and in quick succession all produce footsteps', () => {
  const {sound, context, sources, buffers} = setup()
  for (const time of [0, 0.18, 0.36]) {
    context.currentTime = time
    sound.step('hollow', 9, false)
  }
  expect(sources).toHaveLength(9)
  expect(buffers[0]).not.toEqual(buffers[2])
  sound.step('generic', 0, false)
  expect(sources).toHaveLength(9)
})
test('landing reuses the Soft Weight timbre and increases strength with fall speed', () => {
  const light = setup()
  light.sound.land('generic', 5, false, 2)
  const heavy = setup()
  heavy.sound.land('generic', 5, false, 9)
  expect(light.sources[0].frequency.setValueAtTime.mock.calls[0][0]).toBe(heavy.sources[0].frequency.setValueAtTime.mock.calls[0][0])
  const lightPeak = Math.max(...light.gains.slice(engineGains + 1).map(gain => gain.gain.linearRampToValueAtTime.mock.calls[0]?.[0] ?? 0))
  const heavyPeak = Math.max(...heavy.gains.slice(engineGains + 1).map(gain => gain.gain.linearRampToValueAtTime.mock.calls[0]?.[0] ?? 0))
  expect(heavyPeak).toBeGreaterThan(lightPeak)
})
test('landing prevents a duplicate footfall at impact, not subsequent strides', () => {
  const {sound, context, sources} = setup()
  sound.land('generic', 3, false, 5)
  sound.step('generic', 3, false)
  context.currentTime = 0.05
  sound.step('generic', 3, false)
  expect(sources).toHaveLength(3)
  context.currentTime = 0.11
  sound.step('generic', 3, false)
  expect(sources).toHaveLength(6)
})
test('zoom sweeps use the transition duration and reversals fade the previous sound', () => {
  const {sound, context, sources, gains} = setup()
  sound.zoomTransition(false, false, 0.4)
  expect(sources).toHaveLength(2)
  expect(sources[0].stop).toHaveBeenLastCalledWith(0.4)
  expect(sources[0].frequency.setValueAtTime).toHaveBeenCalledWith(190, 0)
  context.currentTime = 0.1
  sound.zoomTransition(true, true, 0.3)
  expect(sources[0].stop).toHaveBeenLastCalledWith(0.125)
  expect(gains[engineGains].gain.cancelAndHoldAtTime).toHaveBeenCalledWith(0.1)
  expect(sources[2].frequency.setValueAtTime).toHaveBeenCalledWith(1260, 0.1)
  expect(sources[2].stop).toHaveBeenLastCalledWith(0.4)
  sound.zoomTransition(false, false, 0)
  expect(sources).toHaveLength(4)
})
test('held zoom has one quiet bed, follows zoom amount, and stops on release', () => {
  const {sound, context, sources, gains} = setup()
  for (let i = 1; i <= 100; i++) {
    sound.setZoom(i / 100)
  }
  expect(sources).toHaveLength(2)
  expect(sources[0].stop).not.toHaveBeenCalled()
  expect(gains[engineGains].gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 0, 0.025)
  sound.zoomTransition(true, false, 0)
  expect(gains[engineGains].gain.setTargetAtTime).toHaveBeenLastCalledWith(1.35, 0, 0.025)
  context.currentTime = 1
  sound.setZoom(0)
  expect(sources[0].stop).toHaveBeenLastCalledWith(1.06)
  sound.setZoom(0)
  expect(sources[0].stop).toHaveBeenCalledTimes(1)
})
test('muting and cleanup stop sustained and transitioning sounds without queuing muted actions', () => {
  const {sound, sources} = setup()
  sound.setZoom(1)
  sound.zoomTransition(true, false, 0.2)
  sound.viewTransition(true)
  const count = sources.length
  sound.mute(true)
  for (const source of sources) {
    expect(source.stop).toHaveBeenCalled()
  }
  sound.setZoom(1)
  sound.zoomTransition(false, false, 0.2)
  sound.viewTransition(false)
  sound.step('generic', 9, false)
  sound.land('generic', 3, false, 8)
  sound.tone(320)
  expect(sources).toHaveLength(count)
  sound.mute(false)
  expect(sources).toHaveLength(count)
  sound.setZoom(1)
  expect(sources).toHaveLength(count + 2)
  sound.stopPlayerSounds()
  sound.stopPlayerSounds()
  expect(sources.at(-1)!.stop).toHaveBeenCalledTimes(1)
})
test('viewing mode reversal cancels its delayed voices and completed nodes disconnect', () => {
  const {sound, sources, gains, filters} = setup()
  sound.viewTransition(true)
  const entering = [...sources]
  sound.viewTransition(false)
  expect(entering[2].stop).toHaveBeenLastCalledWith(0.025)
  for (const source of sources) {
    source.dispatchEvent(new Event('ended'))
    expect(source.disconnect).toHaveBeenCalledTimes(1)
  }
  for (const node of [...gains.slice(engineGains), ...filters]) {
    expect(node.disconnect).toHaveBeenCalledTimes(1)
  }
  for (const node of gains.slice(0, engineGains)) {
    expect(node.disconnect).not.toHaveBeenCalled()
  }
})
test('delayed footstep layers are intrinsically silent before their scheduled attack', () => {
  const {sound, gains} = setup()
  sound.step('generic', 9, false)
  for (const envelope of gains.slice(engineGains + 1)) {
    expect(envelope.gain.value).toBe(0)
  }
})
test('world sounds reach the master through the moods’ transformers, the interface’s directly', () => {
  const {sound, context, gains} = setup()
  const [master, , world] = gains
  const [dry, send, outlet] = gains.slice(3, 6)
  const last = gains[engineGains - 1]
  expect(sound.world.master).toBe(world as unknown as AudioNode)
  expect(world.connect).toHaveBeenCalledWith(dry)
  expect(world.connect).toHaveBeenCalledWith(send)
  expect(last.connect).toHaveBeenCalledWith(master)
  const busOf = (play: () => void) => {
    const count = gains.length
    play()
    return gains[count]
  }
  expect(busOf(() => sound.step('generic', 3, false)).connect).toHaveBeenCalledWith(world)
  expect(busOf(() => sound.tone(320)).connect).toHaveBeenCalledWith(world)
  expect(busOf(() => sound.playEffect('SFX-42')).connect).toHaveBeenCalledWith(master)
  expect(busOf(() => sound.playEffect('SFX-44', sound.world)).connect).toHaveBeenCalledWith(world)
  expect(busOf(() => sound.viewTransition(true)).connect).toHaveBeenCalledWith(master)
  context.currentTime = 1
  const transformer = mock((_context: BaseAudioContext, input: AudioNode, output: AudioNode) => {
    input.connect(output)
    return noRelease
  })
  const before = gains.length
  sound.transformers.transform(transformer, transformer, 1)
  expect(gains).toHaveLength(before)
  expect(transformer).toHaveBeenCalledTimes(1)
  expect(transformer.mock.calls[0]).toEqual([context as unknown as BaseAudioContext, send as unknown as AudioNode, outlet as unknown as AudioNode])
  expect(send.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 1, 0.03)
  expect(dry.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, 0.03)
})
