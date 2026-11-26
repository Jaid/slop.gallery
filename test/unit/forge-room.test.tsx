import type {RapierRigidBody} from '@react-three/rapier'
import type {Mesh, Scene} from 'three/webgpu'

import {afterAll, beforeAll, describe, expect, test} from 'bun:test'

import {Ray} from '@dimforge/rapier3d-compat'
import {useThree} from '@react-three/fiber'
import {MeshBasicMaterial} from 'three/webgpu'

import {workbench} from '../../src/lib/gallery/alchemy/alchemyMachine.ts'
import forge from '../../src/lib/gallery/forge.ts'
import EndGrainMaterial from '../../src/lib/materials/forge/EndGrainMaterial.ts'
import ForgeRoom from '../../src/rooms/forge/components/ForgeRoom/index.tsx'
import {mountPhysics} from './helpers/inertPhysics.tsx'

const material = new MeshBasicMaterial
let mounted: Awaited<ReturnType<typeof mountPhysics>>
let scene: Scene | undefined
function SceneProbe() {
  scene = useThree(state => state.scene)
  return null
}
beforeAll(async () => {
  // Every finish of the room but its floors is the same plain material; only the colliders and the floors matter here.
  mounted = await mountPhysics(<>
    <ForgeRoom masonry={material} materials={new Proxy({}, {get: () => material}) as never} />
    <SceneProbe />
  </>)
  mounted.physics.step(1 / 60)
})
afterAll(async () => {
  await mounted[Symbol.asyncDispose]()
  material.dispose()
})
describe('the Forge as mounted', () => {
  test('its floor’s collider lies flush with the floor it shows, all along the aisle', () => {
    const {world} = mounted.physics
    const [x] = forge.center
    const north = forge.center[1] - forge.size[1] / 2
    const benchFront = workbench.center[1] - workbench.depth / 2
    for (let z = north + 0.5; z < benchFront - 0.3; z += 0.5) {
      const hit = world.castRay(new Ray({
        x,
        y: 0.5,
        z,
      }, {
        x: 0,
        y: -1,
        z: 0,
      }), 1, true)
      expect(hit).not.toBeNull()
      expect(0.5 - hit!.timeOfImpact).toBeCloseTo(0, 4)
    }
  })
  test('the alchemy workbench hangs still on its hinge through frames of any length, its legs clear of the floor, and falls asleep', () => {
    const {rigidBodyStates, step, world} = mounted.physics
    let bench: RapierRigidBody | undefined
    for (const [handle, state] of rigidBodyStates) {
      if (state.object.name === 'alchemy-workbench') {
        bench = world.getRigidBody(handle)
      }
    }
    expect(bench).toBeDefined()
    const start = bench!.translation()
    let drift = 0
    // long frames like a tab coming back from the background, which step up to 30 times at once, between short ones
    for (let frame = 0; frame < 40; frame++) {
      step([0.5, 0.004, 0.25, 1 / 60][frame % 4])
      const {x, y, z} = bench!.translation()
      drift = Math.max(drift, Math.hypot(x - start.x, y - start.y, z - start.z))
    }
    expect(drift).toBeLessThan(0.001)
    expect(bench!.isSleeping()).toBe(true)
  })
  test('the room’s floor and the vestibule’s are each end-grain of their own, and in this page’s fast graphics neither mirrors the room', () => {
    const materials = new Set<EndGrainMaterial>
    for (const name of ['forge-block-floor', 'forge-vestibule-floor']) {
      const floor = scene!.getObjectByName(name) as Mesh
      expect(floor.material).toBeInstanceOf(EndGrainMaterial)
      const floorMaterial = floor.material as EndGrainMaterial
      materials.add(floorMaterial)
      // Heavy graphics build the same floors with a mirror; the material’s own tests cover both, as a page only ever builds its own quality’s.
      expect(floorMaterial.reflectionTarget ?? null).toBeNull()
    }
    expect(materials.size).toBe(2)
  })
})
