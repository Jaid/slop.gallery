import {afterEach, beforeEach, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Group, PerspectiveCamera} from 'three/webgpu'

import createGrabController from '../../src/components/Scene/interaction/grabController.ts'
import {bodyPose, cameraPose, useGallery} from '../../src/lib/gallery.ts'
import portraitObjects from '../../src/lib/gallery/portraitObjects.ts'
import {itemLaunch} from '../../src/lib/physics/itemLaunch.ts'
import samplePortraits from './fixtures/portraits.ts'

await RAPIER.init()
const original = {...useGallery.getState()}
const originalVelocity = bodyPose.velocity
let world: RAPIER.World
const camera = new PerspectiveCamera
const portrait = {
  ...samplePortraits[0],
  id: 'release-test',
}
beforeEach(() => {
  world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...portrait.position))
  world.createCollider(RAPIER.ColliderDesc.cuboid(1.1, 1.1, 0.06).setTranslation(0, 0, 0.03).setMass(2), body)
  body.setEnabled(false)
  portraitObjects.set(portrait.id, {
    body,
    group: new Group,
  })
  useGallery.setState({
    portraits: [portrait],
    held: portrait.id,
    sound: false,
  })
  bodyPose.velocity = [2, 4, -6]
  camera.position.set(0, 2, 0)
  camera.rotation.set(0, 0, 0)
})
afterEach(() => {
  portraitObjects.delete(portrait.id)
  useGallery.setState(original)
  bodyPose.velocity = originalVelocity
  cameraPose.posed = false
  world.free()
})
test.each(['throw', 'drop', 'cancel'] as const)('a portrait %s uses local clearance and carrier momentum, not its old wall', action => {
  const controls = createGrabController(camera, {current: null}, world)
  if (action === 'cancel') {
    controls.cancel()
  } else {
    controls.release(action === 'throw')
  }
  const released = useGallery.getState().portraits[0]
  expect(useGallery.getState().held).toBeNull()
  expect(released.hung).toBe(false)
  expect(released.wallId).toBeUndefined()
  expect(released.position).toEqual([0, 1.78, -1.45])
  const launch = itemLaunch(2, [0, 0, -1], bodyPose.velocity, action === 'throw')
  for (const axis of [0, 1, 2]) {
    expect(released.velocity![axis]).toBeCloseTo(launch.velocity[axis], 5)
  }
  expect(released.spin).toEqual(launch.spin)
})
test('a blocked portrait release retains the grip and restores its rotation without changing the collection', () => {
  world.createCollider(RAPIER.ColliderDesc.cuboid(4, 4, 4))
  world.step()
  const body = portraitObjects.get(portrait.id)!.body
  const rotation = body.rotation()
  camera.rotation.y = 1
  const controls = createGrabController(camera, {current: null}, world)
  controls.release(true)
  expect(useGallery.getState().held).toBe(portrait.id)
  expect(useGallery.getState().portraits[0]).toBe(portrait)
  expect(body.rotation()).toEqual(rotation)
  expect(body.isEnabled()).toBe(false)
  controls.cancel()
  expect(useGallery.getState().held).toBe(portrait.id)
})
test('a posed capture camera does not inherit motion from the player it left behind', () => {
  cameraPose.posed = true
  createGrabController(camera, {current: null}, world).cancel()
  expect(useGallery.getState().portraits[0].velocity).toEqual([0, 0, 0])
})
