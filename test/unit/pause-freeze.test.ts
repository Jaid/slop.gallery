import {afterEach, describe, expect, mock, spyOn, test} from 'bun:test'

import {NodeFrame} from 'three/webgpu'

import {TestTarget} from '../../packages/use-pause-menu/test/browser.ts'
import {narrator} from '../../src/lib/audio/narration.ts'
import {attachPlayerAudio} from '../../src/lib/audio/playerAudio.ts'
import SoundEngine from '../../src/lib/audio/SoundEngine.ts'
import {AnimationClock, isWorldClockPaused, setWorldClockPaused, worldNow} from '../../src/lib/frozenTime.ts'
import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import {portalFrame} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {attachPauseFreeze} from '../../src/lib/pauseFreeze.ts'
import pauseMenu, {isPauseFrozen} from '../../src/lib/pauseMenu.ts'
import audioFixture from './audioFixture.ts'

const originalGalleryState = useGallery.getState()
const originalContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
const originalNow = Object.getOwnPropertyDescriptor(performance, 'now')
afterEach(() => {
  setWorldClockPaused(false)
  narrator.paused = false
  useGallery.setState(originalGalleryState)
  if (originalContext) {
    Object.defineProperty(globalThis, 'AudioContext', originalContext)
  } else {
    Reflect.deleteProperty(globalThis, 'AudioContext')
  }
  if (originalNow) {
    Object.defineProperty(performance, 'now', originalNow)
  }
})
describe('Escape pause freeze mode', () => {
  test('isPauseFrozen is true only when unlocked in the pause stage', () => {
    for (const stage of ['first', 'return', 'reset', 'unfocus'] as const) {
      expect(isPauseFrozen({
        locked: false,
        stage,
      })).toBe(false)
      expect(isPauseFrozen({
        locked: true,
        stage,
      })).toBe(false)
    }
    expect(isPauseFrozen({
      locked: true,
      stage: 'pause',
    })).toBe(false)
    expect(isPauseFrozen({
      locked: false,
      stage: 'pause',
    })).toBe(true)
  })
  test('world clock, AnimationClock and NodeFrame freeze while paused and resume without jumping', () => {
    let clockMs = 1000
    spyOn(performance, 'now').mockImplementation(() => clockMs)
    const animation = new AnimationClock
    const nodeFrame = new NodeFrame
    expect(worldNow()).toBe(1000)
    expect(animation.advance(0.25)).toBeCloseTo(0.25)
    nodeFrame.update()
    expect(nodeFrame.time).toBe(0)
    clockMs = 1500
    nodeFrame.update()
    expect(nodeFrame.time).toBeCloseTo(0.5)
    expect(nodeFrame.deltaTime).toBeCloseTo(0.5)
    setWorldClockPaused(true)
    expect(isWorldClockPaused()).toBe(true)
    clockMs = 11_500
    expect(worldNow()).toBe(1500)
    expect(animation.advance(10)).toBeCloseTo(0.25)
    nodeFrame.update()
    expect(nodeFrame.deltaTime).toBe(0)
    expect(nodeFrame.time).toBeCloseTo(0.5)
    setWorldClockPaused(false)
    expect(isWorldClockPaused()).toBe(false)
    expect(worldNow()).toBe(1500)
    nodeFrame.update()
    expect(nodeFrame.deltaTime).toBe(0)
    expect(nodeFrame.time).toBeCloseTo(0.5)
    clockMs = 11_700
    expect(worldNow()).toBe(1700)
    expect(animation.advance(0.2)).toBeCloseTo(0.45)
    nodeFrame.update()
    expect(nodeFrame.deltaTime).toBeCloseTo(0.2)
    expect(nodeFrame.time).toBeCloseTo(0.7)
  })
  test('Fusion timeline freezes while world clock is paused and resumes on unpause', async () => {
    let clockMs = 5000
    spyOn(performance, 'now').mockImplementation(() => clockMs)
    const frame = portalFrame({
      position: [2, 2.4, -5],
      rotation: Math.PI / 2,
    }, {
      floor: 0,
      room: 8,
      sides: [6, 6],
    })
    const fusion = new Fusion({
      work: {
        id: 'work',
        position: [2, 2.4, -5],
        rotation: Math.PI / 2,
        width: 1.2,
        height: 1.6,
      },
      partner: {
        kind: 'item',
        id: 'prop',
      },
      images: ['work.jxl'],
      latches: ['charge', 'charge'],
      effects: [],
    }, {
      frame,
      timing: {
        intro: 0.04,
        lull: 0.02,
        image: 0.02,
        minimum: 0.1,
        climax: 0.04,
        afterglow: 0.02,
        fizzle: 0.04,
      },
    })
    clockMs = 5060
    expect(fusion.elapsed()).toBeCloseTo(0.06)
    setWorldClockPaused(true)
    clockMs = 25_060
    expect(fusion.elapsed()).toBeCloseTo(0.06)
    const outcome = fusion.succeed(new Blob(['result']))
    await Bun.sleep(60)
    expect(fusion.closed).toBe(false)
    setWorldClockPaused(false)
    clockMs = 25_200
    await outcome
    fusion.emerge()
    clockMs = 25_300
    await new Promise(resolve => setTimeout(resolve, 60))
    expect(fusion.closed).toBe(true)
  })
  test('SoundEngine.setPaused suspends AudioContext, blocks new cues and resumes on unpause', async () => {
    const fixture = audioFixture()
    const suspend = mock(async () => {
      fixture.context.state = 'suspended'
    })
    const resume = mock(async () => {
      fixture.context.state = 'running'
    })
    Object.assign(fixture.context, {
      suspend,
      resume,
    })
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class {
        constructor() {
          return fixture.context
        }
      },
    })
    const sound = Reflect.construct(SoundEngine, []) as SoundEngine
    sound.setZoom(1)
    const beforePause = fixture.sources.length
    expect(beforePause).toBeGreaterThan(0)
    sound.setPaused(true)
    expect(suspend).toHaveBeenCalledTimes(1)
    expect(fixture.sources[0].stop).toHaveBeenCalled()
    await sound.resume()
    expect(resume).not.toHaveBeenCalled()
    sound.playEffect('SFX-42')
    sound.step('generic', 5, false)
    sound.land('generic', 5, false, 6)
    sound.tone(320)
    sound.viewTransition(true)
    sound.zoomTransition(false, false, 0.2)
    sound.setZoom(0.8)
    expect(fixture.sources).toHaveLength(beforePause)
    sound.mute(true)
    expect(fixture.gains[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0)
    sound.setPaused(false)
    expect(resume).toHaveBeenCalledTimes(1)
    sound.mute(false)
    sound.playEffect('SFX-43')
    expect(fixture.sources.length).toBeGreaterThan(beforePause)
  })
  test('attachPauseFreeze and playerAudio freeze on Escape pause and preserve current behavior on unfocus', () => {
    const target = new TestTarget
    const disconnect = pauseMenu.attach(target.element)
    const sound = {
      step: mock((_surface: string, _speed: number, _crouching: boolean) => {}),
      land: mock((_surface: string, _speed: number, _crouching: boolean, _impactSpeed: number) => {}),
      playEffect: mock((_id: string) => {}),
      zoomTransition: mock((_extended: boolean, _retract: boolean, _duration: number) => {}),
      setZoom: mock((_amount: number) => {}),
      viewTransition: mock((_entering: boolean) => {}),
      mute: mock((_muted: boolean) => {}),
      stopPlayerSounds: mock(() => {}),
      setPaused: mock((_paused: boolean) => {}),
    }
    const existing = spyOn(SoundEngine, 'existing').mockReturnValue(sound as unknown as SoundEngine)
    const detachAudio = attachPlayerAudio(new EventTarget)
    const detachFreeze = attachPauseFreeze()
    const syncLock = pauseMenu.subscribe(() => {
      useGallery.setState({locked: pauseMenu.getSnapshot().locked})
    })
    try {
      useGallery.setState({
        sound: true,
        locked: false,
      })
      // Enter gameplay.
      target.ownerDocument.change(target)
      expect(isWorldClockPaused()).toBe(false)
      expect(narrator.paused).toBe(false)
      expect(sound.setPaused).toHaveBeenLastCalledWith(false)
      // Escape pause freezes world clock, pauses audio and narrator, and skips SFX-42.
      target.ownerDocument.escape()
      target.ownerDocument.change(null)
      expect(pauseMenu.getSnapshot().stage).toBe('pause')
      expect(isWorldClockPaused()).toBe(true)
      expect(narrator.paused).toBe(true)
      expect(sound.setPaused).toHaveBeenLastCalledWith(true)
      expect(sound.stopPlayerSounds).toHaveBeenCalled()
      expect(sound.playEffect).not.toHaveBeenCalledWith('SFX-42')
      // Resuming unfreezes and plays SFX-43.
      target.ownerDocument.change(target)
      expect(isWorldClockPaused()).toBe(false)
      expect(narrator.paused).toBe(false)
      expect(sound.setPaused).toHaveBeenLastCalledWith(false)
      expect(sound.playEffect).toHaveBeenLastCalledWith('SFX-43')
      // Windows key / tabbing out (unfocus) retains existing behavior: world clock, audio and narrator keep running, and SFX-42 plays.
      target.ownerDocument.blur()
      target.ownerDocument.change(null)
      expect(pauseMenu.getSnapshot().stage).toBe('unfocus')
      expect(isWorldClockPaused()).toBe(false)
      expect(narrator.paused).toBe(false)
      expect(sound.setPaused).toHaveBeenLastCalledWith(false)
      expect(sound.playEffect).toHaveBeenLastCalledWith('SFX-42')
    } finally {
      syncLock()
      detachFreeze()
      detachAudio()
      existing.mockRestore()
      disconnect()
    }
  })
})
