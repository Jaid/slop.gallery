import type {narrator as AppNarrator} from '../../src/lib/audio/narration.ts'
import type SoundEngine from '../../src/lib/audio/SoundEngine.ts'
import type {bodyPose as BodyPose, useGallery as GalleryStore} from '../../src/lib/gallery.ts'
import type {default as Menu} from '../../src/lib/pauseMenu.ts'
import type WorldClock from '../../src/lib/WorldClock.ts'
import type {NodeFrame} from 'three/webgpu'

import {_roots} from '@react-three/fiber'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
/** Run on a ready Vite page after clicking Enter. Uses real pointer-lock changes; explicit release stands in for Escape’s browser UI gesture, which CDP key dispatch does not perform. */
export default async function verify() {
  const {default: menu} = await load('/src/lib/pauseMenu.ts') as {default: typeof Menu}
  const {default: time} = await load('/src/lib/worldTime.ts') as {default: WorldClock}
  const {default: Sound} = await load('/src/lib/audio/SoundEngine.ts') as {default: typeof SoundEngine}
  const {narrator} = await load('/src/lib/audio/narration.ts') as {narrator: typeof AppNarrator}
  const {bodyPose, useGallery, flingPlayer} = await load('/src/lib/gallery.ts') as {
    bodyPose: typeof BodyPose
    flingPlayer: (velocity: [number, number, number]) => void
    useGallery: typeof GalleryStore
  }
  const root = _roots.values().next().value?.store
  assert(root && menu.getSnapshot().locked, 'Enter the ready world before running this fixture.')
  const sound = Sound.get()
  const wasSound = useGallery.getState().sound
  useGallery.setState({sound: true})
  await sound.resume()
  const renderer = root.getState().renderer
  const nodeFrame = (renderer as unknown as {_nodes: {nodeFrame: NodeFrame}})._nodes.nodeFrame
  const sample = () => ({
    frames: renderer.info.frame,
    renders: renderer.info.calls,
    shader: nodeFrame.time,
    world: time.now(),
    audio: sound.context.currentTime,
    audioState: sound.context.state,
    position: [...bodyPose.center],
    mode: root.getState().frameloop,
  })
  const until = async (condition: () => boolean) => {
    const end = performance.now() + 5000
    while (!condition()) {
      assert(performance.now() < end, `Timed out: ${condition.toString()}; ${JSON.stringify({
        menu: menu.getSnapshot(),
        enabled: narrator.enabled,
        narration: narrator.getSnapshot(),
        audio: sound.context.state,
        paused: time.paused,
      })}`)
      await wait(10)
    }
  }
  const results = []
  try {
    // A real media element routed through the engine, long enough not to end during the test. Its transport must pause too, not just its AudioContext.
    const samples = 48_000 * 10
    const wav = new ArrayBuffer(44 + samples * 2)
    const view = new DataView(wav)
    const bytes = new Uint8Array(wav)
    const encoder = new TextEncoder
    const text = (offset: number, value: string) => bytes.set(encoder.encode(value), offset)
    text(0, 'RIFF')
    text(8, 'WAVE')
    text(12, 'fmt ')
    text(36, 'data')
    view.setUint32(4, wav.byteLength - 8, true)
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, 48_000, true)
    view.setUint32(28, 96_000, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    view.setUint32(40, samples * 2, true)
    narrator.push({audio: new Blob([wav], {type: 'audio/wav'})}, {
      priority: 'destructive',
      prependedSilence: 0,
    })
    await until(() => narrator.getSnapshot().current?.phase === 'playing')
    const narrationId = narrator.getSnapshot().current!.metadata.instanceId
    flingPlayer([0, 4, 0])
    await wait(80)
    menu.release('pause')
    await until(() => time.paused && sound.context.state === 'suspended')
    const paused = sample()
    const speech = narrator.progress(narrationId)
    // Menu-triggered resume, resize and invalidation must not wake the world.
    await sound.resume()
    root.getState().invalidate()
    globalThis.dispatchEvent(new Event('resize'))
    globalThis.dispatchEvent(new Event('blur'))
    await wait(1200)
    const held = sample()
    assert(held.frames === paused.frames && held.renders === paused.renders && held.mode === 'never', `Escape kept rendering frames: ${JSON.stringify({
      paused,
      held,
    })}`)
    assert(held.shader === paused.shader && held.world === paused.world, 'Escape advanced animation time.')
    assert(held.audio === paused.audio && held.audioState === 'suspended', 'Escape advanced the audio clock.')
    assert(JSON.stringify(held.position) === JSON.stringify(paused.position), 'Physics advanced during Escape pause.')
    assert(JSON.stringify(narrator.progress(narrationId)) === JSON.stringify(speech), 'Narration’s media transport advanced while paused.')
    assert(menu.getSnapshot().stage === 'pause', 'Blur changed an existing Escape pause.')
    await menu.enter()
    await until(() => menu.getSnapshot().locked && sound.context.state === 'running')
    await wait(150)
    const resumed = sample()
    assert(resumed.frames > held.frames && resumed.mode === 'always', 'Resume did not restart frames.')
    assert(resumed.shader - held.shader < 0.5 && resumed.world - held.world < 500, 'Resume included paused wall time.')
    assert(resumed.audio > held.audio, 'Resume did not restart audio.')
    assert(JSON.stringify(resumed.position) !== JSON.stringify(held.position), 'Physics did not resume.')
    results.push({
      mode: 'escape',
      paused,
      held,
      resumed,
    })
    // The focus-loss reason is still latched if focus returns before pointerlockchange, as with the Windows key.
    globalThis.dispatchEvent(new Event('blur'))
    document.exitPointerLock()
    await until(() => !menu.getSnapshot().locked)
    const unfocused = sample()
    assert(menu.getSnapshot().stage === 'unfocus' && !time.paused, 'Focus loss incorrectly froze the world.')
    await wait(300)
    const running = sample()
    assert(running.frames > unfocused.frames && running.shader > unfocused.shader, 'Focus loss stopped rendering or animation.')
    assert(running.audio > unfocused.audio && running.audioState === 'running', 'Focus loss stopped audio.')
    results.push({
      mode: 'unfocus',
      unfocused,
      running,
    })
    return results
  } finally {
    narrator.stop()
    useGallery.setState({sound: wasSound})
    if (!menu.getSnapshot().locked) {
      await menu.enter()
    }
  }
}
// Import the running app’s instances, including Vite’s current HMR suffix, not copies bundled into the fixture.
function load(path: string): Promise<unknown> {
  const loaded = performance.getEntriesByType('resource').findLast(entry => {
    const url = new URL(entry.name)
    return url.pathname === path
  })
  const url = new URL(loaded?.name ?? path, location.href)
  return import(/* @vite-ignore */ url.href)
}
function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message)
  }
}
