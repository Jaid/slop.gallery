import {afterEach, beforeEach, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import KnotRotation, {knotRotationPeriod} from '../../src/lib/physics/KnotRotation.ts'

await RAPIER.init()
let world: RAPIER.World
beforeEach(() => world = new RAPIER.World({
  x: 0,
  y: -9.81,
  z: 0,
}))
afterEach(() => world.free())
test('rotates showcased Knots and colliders together without translating them', () => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(2, 1, 3))
  const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.4, 0.2), body)
  const rotation = new KnotRotation
  // a quarter turn
  for (let i = 0; i < knotRotationPeriod * 15; i++) {
    rotation.advance(1 / 60)
    rotation.step(body)
  }
  world.step()
  expect(rotation.isShowcased(body)).toBe(true)
  expect(body.rotation().y).toBeCloseTo(Math.SQRT1_2, 5)
  expect(body.rotation().w).toBeCloseTo(Math.SQRT1_2, 5)
  expect(collider.rotation().y).toBeCloseTo(body.rotation().y, 5)
  expect(body.translation()).toEqual({
    x: 2,
    y: 1,
    z: 3,
  })
  const before = body.rotation()
  for (const delta of [0, -1, Infinity, Number.NaN]) {
    rotation.advance(delta)
    rotation.step(body)
  }
  expect(body.rotation()).toEqual(before)
})
test('Rapier force release is one-way and never resumes showcase rotation', () => {
  const rotation = new KnotRotation
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  rotation.advance(1)
  rotation.step(body)
  expect(rotation.isShowcased(body)).toBe(true)
  expect(rotation.release(body)).toBe(true)
  expect(rotation.isShowcased(body)).toBe(false)
  expect(body.isDynamic()).toBe(true)
  expect(rotation.release(body)).toBe(false)
  const releasedRotation = body.rotation()
  rotation.advance(10)
  rotation.step(body)
  expect(body.rotation()).toEqual(releasedRotation)
  // A released Knot that is fixed again must not go back into showcase mode.
  body.setBodyType(RAPIER.RigidBodyType.Fixed, true)
  rotation.advance(10)
  rotation.step(body)
  expect(body.rotation()).toEqual(releasedRotation)
  expect(rotation.isShowcased(body)).toBe(false)
})
test('showcase state blocks grabbing until the Knot has been physically released', () => {
  const rotation = new KnotRotation
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body)
  const carried = new GrabbableBody(body, world, {
    canGrab: () => !rotation.isShowcased(body),
  })
  expect(carried.grab()).toBe(false)
  rotation.release(body)
  expect(carried.grab()).toBe(true)
  expect(body.isEnabled()).toBe(false)
  carried.release([0, 1.5, 0], [0, 1.5, 1], false)
  expect(body.isDynamic()).toBe(true)
})
test('Knots that appear late turn in sync with the shared clock, which resets to the start', () => {
  const rotation = new KnotRotation
  const early = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const late = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  for (let i = 0; i < 600; i++) {
    rotation.advance(1 / 60)
    rotation.step(early)
  }
  for (let i = 0; i < 1200; i++) {
    rotation.advance(1 / 120)
    rotation.step(early)
    rotation.step(late)
  }
  expect(late.rotation().y).toBeCloseTo(early.rotation().y, 5)
  expect(late.rotation().w).toBeCloseTo(early.rotation().w, 5)
  rotation.reset()
  rotation.step(early)
  expect(early.rotation().y).toBeCloseTo(0, 5)
  expect(early.rotation().w).toBeCloseTo(1, 5)
  // a full revolution brings a Knot back to where it started
  for (let i = 0; i < knotRotationPeriod * 60; i++) {
    rotation.advance(1 / 60)
  }
  rotation.step(early)
  expect(Math.abs(early.rotation().w)).toBeCloseTo(1, 5)
})
test('leaves ordinary dynamic bodies alone', () => {
  const rotation = new KnotRotation
  const dynamic = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setAngvel({
    x: 1,
    y: 2,
    z: 3,
  }))
  const before = dynamic.rotation()
  rotation.advance(10)
  rotation.step(dynamic)
  expect(dynamic.rotation()).toEqual(before)
  expect(dynamic.angvel()).toEqual({
    x: 1,
    y: 2,
    z: 3,
  })
})
