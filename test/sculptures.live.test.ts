import type {Mesh, Scene} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup} from '../scripts/lib/headlessGallery.ts'
import {sculptures} from '../src/sculptures/index.ts'

for (const id of Object.keys(sculptures)) {
  test.skipIf(Bun.env.LIVE_TEST !== 'true')(`the mounted ${id} sculpture shares its socket’s material`, async () => {
    const setup = await resolveGallerySetup({
      target: Bun.env.LIVE_TARGET ?? 'dist',
      room: 'salon',
      world_reach: 'room',
      sculpture: id,
      seed: '0',
      graphics: 'fast',
      width: '800',
      height: '450',
    })
    // Three’s devtools hook gives the test the actual mounted meshes, without exposing the scene in the game’s API.
    await using gallery = await openHeadlessGallery(setup, {
      cacheDir: 'node_modules/.vite-sculptures',
      initScripts: [() => {
        const scenes: Array<Scene> = []
        const observer = new EventTarget
        observer.addEventListener('observe', event => {
          const object = (event as CustomEvent<Scene>).detail
          if (object.isScene) {
            scenes.push(object)
          }
        })
        Object.assign(globalThis, {
          __THREE_DEVTOOLS__: observer,
          sculptureTestScenes: scenes,
        })
      }],
    })
    const materials = await gallery.page.evaluate(() => {
      const {sculptureTestScenes} = globalThis as typeof globalThis & {sculptureTestScenes?: Array<Scene>}
      const scene = sculptureTestScenes?.find(candidate => candidate.getObjectByName('salon-sculpture'))
      const socket = scene?.getObjectByName('sculpture socket') as Mesh | undefined
      const matches: Array<boolean> = []
      scene?.getObjectByName('salon-sculpture')?.traverseVisible(object => {
        if ('isMesh' in object) {
          matches.push(!!socket?.material && (object as Mesh).material === socket.material)
        }
      })
      return matches
    })
    expect(materials.length).toBeGreaterThan(0)
    expect(materials.every(Boolean)).toBe(true)
  }, 120_000)
}
