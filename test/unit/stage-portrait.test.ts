import type {StagingOutcome} from '../../src/components/PortraitViewer/stagePortrait.ts'
import type {ArtworkHolder} from '../../src/lib/gallery/PortraitModel.ts'
import type {Object3D} from 'three/webgpu'

import {describe, expect, mock, spyOn, test} from 'bun:test'

import {Texture} from 'three/webgpu'

import stagePortrait from '../../src/components/PortraitViewer/stagePortrait.ts'

/** An artwork whose texture loads when the test says so, with what was released. */
const artwork = () => {
  const loading = Promise.withResolvers<Texture>()
  const release = mock(() => {})
  const hold = mock<ArtworkHolder>(() => ({
    texture: loading.promise,
    release,
  }))
  return {
    hold,
    load: () => loading.resolve(new Texture),
    release,
  }
}
/** What stands in for the studio view: like it, the last object asked to be shown takes the stage, and hiding only takes away the object that has it. */
const studio = (compiled: () => Promise<boolean> = () => Promise.resolve(true)) => {
  const view = {
    hide: (object: Object3D) => {
      if (view.subject === object) {
        view.subject = undefined
      }
    },
    show: (object: Object3D) => {
      view.subject = object
      view.shown.push(object)
      return compiled()
    },
    shown: [] as Array<Object3D>,
    subject: undefined as Object3D | undefined,
  }
  return view
}
const work = {
  width: 2.4,
  height: 1.6,
  source: '/art/goose.jxl',
}
const otherWork = {
  ...work,
  source: '/art/swan.jxl',
}
/** what hears how showing the model ended */
const listener = () => mock<(outcome: StagingOutcome) => void>(() => {})
/** Lets every promise that can settle settle. */
const settle = () => Bun.sleep(0)
describe('the model of a work on the studio’s stage', () => {
  test('shows once its artwork has loaded and tells it is ready', async () => {
    const view = studio()
    const {hold, load} = artwork()
    const settled = listener()
    const giveUp = stagePortrait(view, work, settled, hold)
    await settle()
    expect(view.shown).toHaveLength(0)
    load()
    await settle()
    expect(view.shown).toHaveLength(1)
    expect(view.subject).toBe(view.shown[0])
    expect(settled.mock.calls).toEqual([['ready']])
    giveUp()
    await settle()
    expect(view.subject).toBeUndefined()
  })
  test('a work given up on while its artwork still loads never takes the stage from the one after it', async () => {
    const view = studio()
    const given = artwork()
    const next = artwork()
    const settled = {
      given: listener(),
      next: listener(),
    }
    const giveUp = stagePortrait(view, work, settled.given, given.hold)
    giveUp()
    stagePortrait(view, otherWork, settled.next, next.hold)
    next.load()
    await settle()
    const [shown] = view.shown
    expect(settled.next.mock.calls).toEqual([['ready']])
    // The work given up on finishes loading last.
    given.load()
    await settle()
    expect(view.shown).toEqual([shown])
    expect(view.subject).toBe(shown)
    expect(shown.children).not.toHaveLength(0)
    expect(settled.given).not.toHaveBeenCalled()
    expect(given.release).toHaveBeenCalledTimes(1)
    expect(next.release).not.toHaveBeenCalled()
  })
  test('a work given up on while it compiles leaves the stage and is disposed once compiling is done, without telling', async () => {
    const compiling = Promise.withResolvers<boolean>()
    const view = studio(() => compiling.promise)
    const {hold, load, release} = artwork()
    const settled = listener()
    const giveUp = stagePortrait(view, work, settled, hold)
    load()
    await settle()
    expect(view.shown).toHaveLength(1)
    giveUp()
    expect(view.subject).toBeUndefined()
    await settle()
    expect(release).not.toHaveBeenCalled()
    compiling.resolve(false)
    await settle()
    expect(release).toHaveBeenCalledTimes(1)
    expect(settled).not.toHaveBeenCalled()
  })
  test('a work the studio can’t show tells it failed', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const view = studio(() => Promise.reject(new Error('no device')))
      const {hold, load, release} = artwork()
      const settled = listener()
      const giveUp = stagePortrait(view, work, settled, hold)
      load()
      await settle()
      expect(settled.mock.calls).toEqual([['failed']])
      expect(warn).toHaveBeenCalledTimes(1)
      giveUp()
      await settle()
      expect(release).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })
})
