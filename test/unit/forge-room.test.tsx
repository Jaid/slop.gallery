import type {RapierRigidBody} from '@react-three/rapier'
import type {Mesh, Object3D, Scene} from 'three/webgpu'

import {afterAll, beforeAll, describe, expect, test} from 'bun:test'

import {Ray} from '@dimforge/rapier3d-compat'
import {useThree} from '@react-three/fiber'
import {Box3, MeshBasicMaterial, Vector3} from 'three/webgpu'

import {workbench} from '../../src/lib/gallery/alchemy/alchemyMachine.ts'
import forge from '../../src/lib/gallery/forge.ts'
import EndGrainMaterial from '../../src/lib/materials/forge/EndGrainMaterial.ts'
import ForgeRoom from '../../src/rooms/forge/components/ForgeRoom/index.tsx'
import {mountPhysics} from './helpers/inertPhysics.tsx'
import {mockPageGraphics} from './helpers/pageGraphics.ts'

const material = new MeshBasicMaterial
let mounted: Awaited<ReturnType<typeof mountPhysics>>
let graphics: Awaited<ReturnType<typeof mockPageGraphics>> | undefined
let scene: Scene | undefined
const boundsOf = (object: Object3D) => {
  const bounds = new Box3
  return bounds.setFromObject(object)
}
function SceneProbe() {
  scene = useThree(state => state.scene)
  return null
}
beforeAll(async () => {
  // A page with heavy graphics, whose floors mirror the room.
  graphics = await mockPageGraphics('heavy')
  // Every finish of the room but its floors is the same plain material; only the colliders and the floors’ mirrors matter here.
  mounted = await mountPhysics(<>
    <ForgeRoom masonry={material} materials={new Proxy({}, {get: () => material}) as never} />
    <SceneProbe />
  </>)
  mounted.physics.step(1 / 60)
})
afterAll(async () => {
  await mounted[Symbol.asyncDispose]()
  await graphics?.[Symbol.asyncDispose]()
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
    // long frames like a pipeline compiling or a tab coming back from the background, which step up to 30 times at once, between short ones
    for (let frame = 0; frame < 40; frame++) {
      step([0.5, 0.004, 0.25, 1 / 60][frame % 4])
      const {x, y, z} = bench!.translation()
      drift = Math.max(drift, Math.hypot(x - start.x, y - start.y, z - start.z))
    }
    expect(drift).toBeLessThan(0.001)
    expect(bench!.isSleeping()).toBe(true)
  })
  test('in heavy graphics, the room’s floor and the vestibule’s each mirror the room at their own surface, the mirror bounded by that floor alone', () => {
    scene!.updateMatrixWorld(true)
    const targets = new Set<Object3D>
    for (const name of ['forge-block-floor', 'forge-vestibule-floor']) {
      const floor = scene!.getObjectByName(name) as Mesh
      expect(floor.material).toBeInstanceOf(EndGrainMaterial)
      const target = (floor.material as EndGrainMaterial).reflectionTarget!
      expect(target).not.toBeNull()
      targets.add(target)
      expect(target.getWorldPosition(new Vector3).y).toBeCloseTo(0, 6)
      const facing = new Vector3(0, 0, 1)
      expect(facing.transformDirection(target.matrixWorld).y).toBeCloseTo(1, 6)
      // The shared mirror only renders while a floor is in view, by the bounds of the nearest of its target’s ancestors that has any.
      let holder = target.parent
      while (holder && boundsOf(holder).isEmpty()) {
        holder = holder.parent
      }
      expect(boundsOf(holder!).equals(boundsOf(floor))).toBe(true)
    }
    expect(targets.size).toBe(2)
  })
})
