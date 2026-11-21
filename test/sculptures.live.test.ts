import type {Material, Mesh, Scene} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {openHeadlessGallery, resolveGallerySetup} from '../scripts/lib/headlessGallery.ts'
import {sculptures} from '../src/sculptures/index.ts'

for (const id of Object.keys(sculptures)) {
  test.skipIf(Bun.env.LIVE_TEST !== 'true')(`the mounted ${id} sculpture uses its intended finish and fits the triangle budget`, async () => {
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
    const model = await gallery.page.evaluate(() => {
      const {sculptureTestScenes} = globalThis as typeof globalThis & {sculptureTestScenes?: Array<Scene>}
      const scene = sculptureTestScenes?.find(candidate => candidate.getObjectByName('salon-sculpture'))
      const socket = scene?.getObjectByName('sculpture socket') as Mesh | undefined
      const meshes: Array<{
        finish: string
        name: string
        sharesSocket: boolean
        triangles: number
      }> = []
      scene?.getObjectByName('salon-sculpture')?.traverseVisible(object => {
        if ('isMesh' in object && object.isMesh) {
          const {geometry, material, name} = object as Mesh
          const finish = (material as Material).name
          meshes.push({
            name,
            finish,
            sharesSocket: !!socket?.material && material === socket.material,
            triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
          })
        }
      })
      return {
        socket: !!socket,
        meshes,
      }
    })
    expect(model.socket).toBe(true)
    expect(model.meshes.some(({name}) => name === `sculpture-${id}`)).toBe(true)
    expect(model.meshes.reduce((sum, mesh) => sum + mesh.triangles, 0)).toBeLessThanOrEqual(32_768)
    if (id === 'tung_tung_tung_sahur') {
      expect(model.meshes).toHaveLength(1)
      expect(model.meshes[0].finish).toBe('Sahur · oiled wood and enamel')
      expect(model.meshes[0].sharesSocket).toBe(false)
    } else {
      expect(model.meshes.every(mesh => mesh.sharesSocket)).toBe(true)
    }
  }, 120_000)
}
