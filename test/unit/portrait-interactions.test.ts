import {afterEach, beforeEach, expect, test} from 'bun:test'

import {PerspectiveCamera} from 'three/webgpu'

import createGrabController from '../../src/components/Scene/interaction/grabController.ts'
import {cameraPose, galleryEvents, inspect} from '../../src/lib/gallery/actions.ts'
import defaultPortraits from '../../src/lib/gallery/defaultPortraits.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import samplePortraits from './fixtures/portraits.ts'

const original = useGallery.getState()
const focused = cameraPose.focused
beforeEach(() => {
  useGallery.setState({
    ...original,
    portraits: samplePortraits.map(portrait => ({...portrait})),
    sound: false,
    held: null,
    active: samplePortraits[0].id,
    activeLabel: null,
  }, true)
  cameraPose.focused = false
})
afterEach(() => {
  useGallery.setState(original, true)
  cameraPose.focused = focused
})
const first = () => useGallery.getState().portraits[0]
test.each([false, true])('grabbing the portrait (name plate: %s) remembers it even after canceling the grab', label => {
  useGallery.setState({activeLabel: label ? first().id : null})
  const controller = createGrabController(new PerspectiveCamera, {current: null})
  controller.grab()
  expect(useGallery.getState().held).toBe(first().id)
  expect(first().interacted).toBe(true)
  controller.cancel()
  expect(useGallery.getState().held).toBeNull()
  expect(first().interacted).toBe(true)
  expect(first().hung).toBe(true)
})
test.each(['fusing', 'reserved'] as const)('a refused grab of a %s work does not mark it', flag => {
  useGallery.getState().update(first().id, {[flag]: true})
  createGrabController(new PerspectiveCamera, {current: null}).grab()
  expect(useGallery.getState().held).toBeNull()
  expect(first().interacted).toBeUndefined()
})
test.each([false, true])('a successful V-view (name plate: %s) marks the same portrait and still emits its inspection event', label => {
  useGallery.setState({activeLabel: label ? first().id : null})
  const ids: Array<string> = []
  const onInspect = (event: Event) => ids.push((event as CustomEvent<string>).detail)
  galleryEvents.addEventListener('inspect', onInspect)
  try {
    inspect(first().id)
    expect(first().interacted).toBe(true)
    expect(useGallery.getState().inspecting).toBe(first().id)
    expect(ids).toEqual([first().id])
    useGallery.setState({inspecting: null})
    expect(first().interacted).toBe(true)
  } finally {
    galleryEvents.removeEventListener('inspect', onInspect)
  }
})
test('looking at a work, inspecting a prop and repeated interaction do not mark other works or rewrite the collection', () => {
  expect(first().interacted).toBeUndefined()
  const {markInteracted, portraits} = useGallery.getState()
  inspect('not-a-portrait')
  markInteracted('not-a-portrait')
  expect(useGallery.getState().portraits).toBe(portraits)
  markInteracted(first().id)
  const marked = useGallery.getState().portraits
  markInteracted(first().id)
  expect(useGallery.getState().portraits).toBe(marked)
  expect(marked.slice(1).every(portrait => !portrait.interacted)).toBe(true)
})
test('interaction survives collection updates and a new game starts with unvisited works', () => {
  const state = useGallery.getState()
  state.markInteracted(first().id)
  state.update(first().id, {
    hung: false,
    position: [0, 1, 0],
  })
  state.commit([...useGallery.getState().portraits])
  expect(first().interacted).toBe(true)
  state.commit(defaultPortraits(191))
  expect(useGallery.getState().portraits.every(portrait => !portrait.interacted)).toBe(true)
})
