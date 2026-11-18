import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, beforeEach, expect, spyOn, test} from 'bun:test'

import {bodyPose, cameraPose, flyPlayer, galleryEvents, importDroppedFiles, isTextInput, viewPortrait} from '../../src/lib/gallery/actions.ts'
import {flyMode} from '../../src/lib/gallery/flyMode.ts'
import ImageImporter from '../../src/lib/gallery/ImageImporter.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import worldClock from '../../src/lib/worldClock.ts'

const original = useGallery.getState()
const previous = {
  HTMLElement: globalThis.HTMLElement,
  createImageBitmap: globalThis.createImageBitmap,
  OffscreenCanvas: globalThis.OffscreenCanvas,
}
class ElementDouble extends EventTarget {
  isContentEditable = false
  constructor(readonly editable = false) {
    super()
  }
  closest(selector: string) {
    return this.editable && selector === 'input, textarea, select' ? this : null
  }
}
beforeEach(() => {
  useGallery.setState(original, true)
  useGallery.setState({
    sound: false,
    ready: false,
    importTarget: null,
    importFiles: null,
  })
  Object.assign(globalThis, {HTMLElement: ElementDouble})
})
afterEach(() => Object.assign(globalThis, previous))
const file = () => new File(['pixels'], 'square.png', {type: 'image/png'})
test('renderer-free drops decode and commit', async () => {
  Object.assign(globalThis, {
    createImageBitmap: async () => ({
      width: 64,
      height: 64,
      close() {},
    }),
    OffscreenCanvas: class {
      async convertToBlob() {
        return new Blob(['normalized'], {type: 'image/webp'})
      }
      getContext() {
        return {
          fillStyle: '',
          fillRect() {},
          drawImage() {},
        }
      }
    },
  })
  const importer = new ImageImporter(() => {})
  useGallery.setState({importFiles: (files, target) => importer.import(files, target)})
  try {
    await importDroppedFiles([new File(['pixels'], 'fallback.png', {type: 'image/png'})], 100, 100)
    expect(useGallery.getState().portraits).toHaveLength(original.portraits.length + 1)
  } finally {
    importer.dispose()
  }
})
test('dropped images flip off their wall only where their square preview fit in reach, otherwise land at the player’s feet, and go into the collection under the pause menu', async () => {
  Object.assign(globalThis, {
    createImageBitmap: async () => ({
      width: 64,
      height: 64,
      close() {},
    }),
    OffscreenCanvas: class {
      async convertToBlob() {
        return new Blob(['normalized'], {type: 'image/webp'})
      }
      getContext() {
        return {
          fillStyle: '',
          fillRect() {},
          drawImage() {},
        }
      }
    },
  })
  const importer = new ImageImporter(() => {})
  const arrivals = async (files: Array<File>, origin: Vec3, direction: Vec3) => {
    const before = new Set(useGallery.getState().portraits.map(portrait => portrait.id))
    bodyPose.center = [origin[0], origin[1] - 0.8, origin[2]]
    cameraPose.position = origin
    cameraPose.direction = direction
    await importer.import(files, {
      origin,
      direction,
    })
    return useGallery.getState().portraits.filter(portrait => !before.has(portrait.id))
  }
  const poses = {
    center: bodyPose.center,
    position: cameraPose.position,
    direction: cameraPose.direction,
  }
  try {
    useGallery.setState({portraits: []})
    // in reach of a free spot: the first hangs, the next no longer fits there and flips off
    const [hung, flipped] = await arrivals([file(), file()], [4, 2.5, -24], [0, 0, -1])
    expect(hung.hung).toBe(true)
    expect(flipped.hung).toBe(false)
    expect(flipped.velocity?.[2]).toBeGreaterThan(0)
    // out of reach: at the feet, no matter that the square would fit there
    const [far] = await arrivals([file()], [4, 2.5, 5], [0, 0, -1])
    expect(far.hung).toBe(false)
    expect(far.velocity).toBeUndefined()
    expect(far.position[2]).toBeLessThan(5)
    expect(far.position[2]).toBeGreaterThan(4)
    expect(far.position[1]).toBeLessThan(2)
    // in reach, but its square already did not fit: at the feet too
    const [blocked] = await arrivals([file()], [4, 2.5, -24], [0, 0, -1])
    expect(blocked.hung).toBe(false)
    expect(blocked.velocity).toBeUndefined()
    expect(blocked.position[2]).toBeLessThan(-24)
    expect(blocked.position[2]).toBeGreaterThan(-25)
    // under the pause menu: into the collection, known already, at the feet even aimed at a free wall in reach
    useGallery.setState({portraits: []})
    const release = worldClock.freeze()
    try {
      const [collected] = await arrivals([file()], [4, 2.5, -24], [0, 0, -1])
      expect(collected.hung).toBe(false)
      expect(collected.interacted).toBe(true)
      expect(collected.velocity).toBeUndefined()
      expect(collected.position[2]).toBeLessThan(-24)
      expect(collected.position[2]).toBeGreaterThan(-25)
    } finally {
      release()
    }
    const [unfrozen] = await arrivals([file()], [4, 2.5, -24], [0, 0, -1])
    expect(unfrozen.hung).toBe(true)
    expect(unfrozen.interacted).toBeUndefined()
  } finally {
    importer.dispose()
    bodyPose.center = poses.center
    cameraPose.position = poses.position
    cameraPose.direction = poses.direction
  }
})
test('scene placement is optional', async () => {
  const target = {
    origin: [0, 2, 0] as [number, number, number],
    direction: [0, 0, -1] as [number, number, number],
  }
  const calls: Array<unknown> = []
  useGallery.setState({
    importTarget: () => target,
    importFiles: async (_files, ray) => {
      calls.push(ray)
    },
  })
  await importDroppedFiles([], 12, 34)
  useGallery.setState({importTarget: null})
  await importDroppedFiles([], 12, 34)
  expect(calls).toEqual([target, undefined])
})
test('unavailable navigation does not dispatch a visit', () => {
  const spy = spyOn(galleryEvents, 'dispatchEvent')
  try {
    viewPortrait('goose')
    expect(spy).not.toHaveBeenCalled()
  } finally {
    spy.mockRestore()
  }
})
test('only editable controls count as text input, not whole dialogs', () => {
  expect(isTextInput(new ElementDouble)).toBe(false)
  expect(isTextInput(new ElementDouble(true))).toBe(true)
  const content = new ElementDouble
  content.isContentEditable = true
  expect(isTextInput(content)).toBe(true)
})
test('a flight starts the fly mode and asks the player to fly there, without counting as a teleport', () => {
  const flights: Array<unknown> = []
  let teleports = 0
  const fly = (event: Event) => flights.push((event as CustomEvent).detail)
  const teleport = () => teleports++
  galleryEvents.addEventListener('fly', fly)
  galleryEvents.addEventListener('teleport', teleport)
  const flying = flyMode.active
  try {
    flyMode.active = false
    flyPlayer({position: [1, 2, 3]})
    expect(flyMode.active).toBe(true)
    flyPlayer()
    expect(flights).toEqual([{position: [1, 2, 3]}, {}])
    expect(teleports).toBe(0)
  } finally {
    flyMode.active = flying
    galleryEvents.removeEventListener('fly', fly)
    galleryEvents.removeEventListener('teleport', teleport)
  }
})
