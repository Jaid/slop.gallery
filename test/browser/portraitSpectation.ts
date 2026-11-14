import type {Portrait} from '../../src/lib/gallery/types.ts'
import type {BufferGeometry, Mesh, MeshBasicNodeMaterial, Scene} from 'three/webgpu'

import {_roots} from '@react-three/fiber'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message)
  }
}
const until = async (condition: () => unknown) => {
  const deadline = performance.now() + 30_000
  while (!condition()) {
    assert(performance.now() < deadline, 'Timed out waiting for the portrait studio.')
    await wait(30)
  }
}
const item = (id: string) => document.querySelector<HTMLButtonElement>(`button[data-portrait="${CSS.escape(id)}"]`)
const studioCanvas = () => document.querySelector<HTMLCanvasElement>('[data-testid="portrait-spectation"] canvas')
// Fiber registers the root before its renderer and scene have initialized.
const studioReady = () => {
  const canvas = studioCanvas()
  const scene = canvas ? _roots.get(canvas)?.store.getState().scene as Scene | null | undefined : undefined
  return scene?.getObjectByName('portrait-image')
}
const key = (element: HTMLElement, value: string, shiftKey = false) => element.dispatchEvent(new KeyboardEvent('keydown', {
  key: value,
  bubbles: true,
  cancelable: true,
  shiftKey,
}))
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('[data-testid="portrait-spectation"] button')].find(element => element.textContent === text)

/** Run on a ready, Escape-paused Vite page with test/browser/run.ts. Exercises the DOM and both real WebGPU roots, restoring the collection afterward. */
export default async function verifyPortraitSpectation() {
  // These must be the running Vite app’s singletons, not a second store bundled into the fixture.
  const storeUrl = `${location.origin}/src/lib/gallery/store.ts`
  const objectsUrl = `${location.origin}/src/lib/gallery/portraitObjects.ts`
  const worldUrl = `${location.origin}/src/worlds/current.ts`
  const {useGallery} = await import(/* @vite-ignore */ storeUrl) as typeof import('../../src/lib/gallery/store.ts')
  const {default: objects} = await import(/* @vite-ignore */ objectsUrl) as typeof import('../../src/lib/gallery/portraitObjects.ts')
  const {default: world} = await import(/* @vite-ignore */ worldUrl) as typeof import('../../src/worlds/current.ts')
  const originals = useGallery.getState().portraits
  assert(originals.length >= 2, 'This fixture needs two works.')
  assert(globalThis.slopGallery?.snapshot?.().frozen, 'Open the Escape pause menu first.')
  button('Back to menu')?.click()
  const unknown: Portrait = {
    ...originals[0],
    interacted: false,
  }
  const known: Portrait = {
    ...originals[1],
    interacted: true,
    year: 1924,
  }
  useGallery.setState({portraits: [unknown, known, ...originals.slice(2)]})
  const worldCanvas = document.querySelector<HTMLCanvasElement>('main canvas')!
  const main = _roots.get(worldCanvas)!.store.getState()
  const report: Record<string, unknown> = {}
  try {
    await until(() => item(unknown.id)?.dataset.interacted === 'false')
    item(unknown.id)!.click()
    await until(studioReady)
    await wait(1200)
    const canvas = studioCanvas()!
    const studio = _roots.get(canvas)!.store.getState()
    const image = studio.scene.getObjectByName('portrait-image') as Mesh<BufferGeometry, MeshBasicNodeMaterial>
    const worldImage = objects.get(unknown.id)!.group.getObjectByName('portrait-image') as typeof image
    const frame = studio.scene.getObjectByName('portrait-frame') as Mesh
    const worldFrame = objects.get(unknown.id)!.group.getObjectByName('portrait-frame') as Mesh
    assert(frame.material === worldFrame.material, 'The studio is not using the actual frame materials.')
    assert(frame.geometry.getAttribute('position').count === worldFrame.geometry.getAttribute('position').count, 'The studio frame geometry differs from the world.')
    assert(image.material.map === worldImage.material.map, 'The studio is not using the actual artwork texture.')
    assert(getComputedStyle(canvas).opacity === '0.25', 'An untouched work is not faded.')
    assert(document.querySelector('#portrait-title')?.textContent === unknown.title, 'The untouched work’s plate is missing.')
    assert(!document.querySelector('[data-testid="minimap"]') && !document.querySelector('#enter-gallery'), 'The old map/main columns remain visible.')
    assert(document.querySelector('[data-testid="portrait-collection"]'), 'The collection disappeared.')
    assert(!document.querySelector('[popover]:popover-open'), 'Left click pinned a tooltip or opened a menu.')
    assert(!useGallery.getState().portraits[0].interacted, 'Menu inspection marked the work as interacted with.')
    assert(main.frameloop === 'never' && studio.frameloop === 'demand', 'The studio is not independent of the frozen world.')
    // A rest does not draw either canvas. Rotation draws only the studio and leaves the world camera alone.
    const rest = [main.renderer.info.render.calls, studio.renderer.info.render.calls]
    const worldPose = main.camera.matrixWorld.toArray().join()
    await wait(600)
    assert(main.renderer.info.render.calls === rest[0] && studio.renderer.info.render.calls === rest[1], 'An idle canvas keeps drawing.')
    const front = studio.camera.position.clone()
    canvas.focus()
    key(canvas, 'ArrowRight')
    await wait(100)
    assert(front.distanceTo(studio.camera.position) > 0.01, 'Keyboard orbit did not rotate the view.')
    assert(studio.renderer.info.render.calls > rest[1], 'Orbit did not redraw the studio.')
    assert(main.renderer.info.render.calls === rest[0] && main.camera.matrixWorld.toArray().join() === worldPose, 'Orbit advanced the world.')
    const distance = studio.camera.position.length()
    key(canvas, '+')
    await wait(100)
    assert(studio.camera.position.length() < distance, 'Keyboard zoom did not zoom in.')
    button('Reset view')!.click()
    await wait(100)
    assert(front.distanceTo(studio.camera.position) < 1e-6, 'Reset did not restore the initial view.')
    report.frozenWorldDrawsDuringOrbit = main.renderer.info.render.calls - rest[0]
    report.idleDraws = 0
    // Unmet default works remain non-exportable, even though their studio is now reachable.
    item(unknown.id)!.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    }))
    await wait(60)
    assert(!document.querySelector('[role="menu"]'), 'An untouched default work unexpectedly offers exports.')
    // Switching works reuses the GPU renderer and replaces the real image/frame. Known works are opaque.
    item(known.id)!.click()
    await until(() => document.querySelector('#portrait-title')?.textContent === known.title)
    await wait(150)
    assert(studioCanvas() === canvas && _roots.get(canvas)!.store.getState().renderer === studio.renderer, 'Switching works recreated the renderer.')
    assert(getComputedStyle(canvas).opacity === '1', 'An interacted work is still faded.')
    assert(document.querySelector('[data-testid="portrait-spectation"]')!.textContent.includes('1924'), 'The year did not update.')
    key(item(known.id)!, 'F10', true)
    await until(() => document.querySelector('[role="menu"]:popover-open'))
    assert(document.querySelectorAll('[role="menuitem"]').length === 3, 'An export action is missing.')
    // Native popover Escape is tested by the driver; synthetic keyboard events have no browser default action.
    document.querySelector<HTMLElement>('[role="menu"]')!.hidePopover()
    await wait(100)
    button('Back to menu')!.click()
    await until(() => document.querySelector('[data-testid="minimap"]'))
    assert(document.activeElement === item(known.id), 'Closing did not restore focus to the selected cell.')
    await until(() => !_roots.has(canvas))
    // Reopen after full disposal: shared frame materials and artwork textures must still work.
    item(known.id)!.click()
    await until(studioReady)
    const reopened = studioCanvas()!
    await wait(600)
    assert(_roots.get(reopened)!.store.getState().renderer.info.render.calls > 0, 'The studio did not render after reopening.')
    // A loose work’s visible group can move without a store notification; the current room must follow it.
    const room = world.roomById('oculus') ?? world.room(world.defaultRoom)
    useGallery.getState().update(known.id, {hung: false})
    await wait(100)
    const group = objects.get(known.id)!.group
    const saved = group.position.clone()
    const position = group.parent!.worldToLocal(saved.clone().fromArray(room.spawn.position))
    group.position.copy(position)
    try {
      await until(() => document.querySelector('[data-testid="portrait-room"]')?.textContent === room.title)
    } finally {
      group.position.copy(saved)
    }
    report.currentRoomFollowsLiveGroup = true
    // New image data and dimensions reach an open model too, like an import or a fusion result.
    const incoming = new OffscreenCanvas(32, 128)
    const context = incoming.getContext('2d')!
    context.fillStyle = '#3ab47d'
    context.fillRect(0, 0, 32, 128)
    const source = await incoming.convertToBlob({type: 'image/png'})
    useGallery.getState().update(known.id, {
      width: 0.5,
      height: 2,
      title: 'Tall replacement',
      source,
      imported: true,
      year: undefined,
      interacted: false,
    })
    await until(() => document.querySelector('#portrait-title')?.textContent === 'Tall replacement')
    assert(getComputedStyle(reopened).opacity === '0.25', 'A live interaction-state update was ignored.')
    assert(document.querySelector('[data-testid="portrait-spectation"]')!.textContent.includes('Undated'), 'A missing year was not shown as undated.')
    await until(() => {
      const current = _roots.get(reopened)!.store.getState().scene.getObjectByName('portrait-image') as typeof image
      const decoded = current.material.map?.image as HTMLCanvasElement | undefined
      return decoded?.width === 32 && decoded.height === 128
    })
    // Imported works remain exportable before any interaction, unlike untouched default works.
    key(item(known.id)!, 'F10', true)
    await until(() => document.querySelector('[role="menu"]:popover-open'))
    document.querySelector<HTMLElement>('[role="menu"]')!.hidePopover()
    report.newImageDecoded = true
    // A selected work consumed by a fusion leaves neither a stale plate nor a renderer behind.
    useGallery.getState().remove(known.id)
    await until(() => !document.querySelector('[data-testid="portrait-spectation"]'))
    await until(() => !_roots.has(reopened))
    assert(document.querySelector('[data-testid="minimap"]'), 'Removing the selected work did not restore the map.')
    report.rendererRootsAfterClose = _roots.size
    report.reopenedAndDisposed = true
    return report
  } finally {
    button('Back to menu')?.click()
    useGallery.setState({portraits: originals})
  }
}
