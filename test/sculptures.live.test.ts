import type {Mesh, Scene} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup} from '../scripts/lib/headlessGallery.ts'
import {sculptures} from '../src/sculptures/index.ts'

for (const id of Object.keys(sculptures)) {
  test.skipIf(Bun.env.LIVE_TEST !== 'true')(`the mounted ${id} sculpture shares its socket’s material and stays within budget`, async () => {
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
    const meshes = await gallery.page.evaluate(() => {
      const {sculptureTestScenes} = globalThis as typeof globalThis & {sculptureTestScenes?: Array<Scene>}
      const scene = sculptureTestScenes?.find(candidate => candidate.getObjectByName('salon-sculpture'))
      const socket = scene?.getObjectByName('sculpture socket') as Mesh | undefined
      const visible: Array<{
        sharedStone: boolean
        triangles: number
      }> = []
      scene?.getObjectByName('salon-sculpture')?.traverseVisible(object => {
        if ('isMesh' in object && object.isMesh) {
          const {geometry, material} = object as Mesh
          visible.push({
            sharedStone: !!socket?.material && material === socket.material,
            triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
          })
        }
      })
      return visible
    })
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.every(mesh => mesh.sharedStone)).toBe(true)
    expect(meshes.reduce((count, mesh) => count + mesh.triangles, 0)).toBeLessThanOrEqual(32_768)
  }, 120_000)
}
