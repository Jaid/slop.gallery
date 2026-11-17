import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import {itemMass, launchSpeed} from '../../src/lib/physics/itemLaunch.ts'
import {bodyThrow} from '../../src/lib/physics/ThrowState.ts'

await RAPIER.init()
let world: RAPIER.World
beforeEach(() => {
  world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
})
afterEach(() => world.free())
/** a dynamic box with two colliders, like a sculpture with a cover */
const sculpture = () => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1, 2, 3))
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.05, 0.4), body)
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.35, 0.01, 0.45).setTranslation(0, 0.06, 0), body)
  return body
}
describe('shared grabbing regressions', () => {
  test('lower-gallery props only recover after falling below the lower floor', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 3))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2), body)
    const carried = new GrabbableBody(body, world)
    carried.rememberHome()
    body.setTranslation({
      x: 0,
      y: -8.5,
      z: 15,
    }, true)
    carried.recover()
    expect(body.translation().y).toBeCloseTo(-8.5)
    body.setTranslation({
      x: 0,
      y: -13,
      z: 15,
    }, true)
    carried.recover()
    expect(body.translation()).toEqual({
      x: 0,
      y: 2,
      z: 3,
    })
  })
  test('carrying disables the pickup body; even a quiet release puts it at the hand', () => {
    const body = sculpture()
    body.setLinvel({
      x: 1,
      y: 0,
      z: 0,
    }, true)
    const carried = new GrabbableBody(body, world)
    expect(carried.grab()).toBe(true)
    expect(carried.grab()).toBe(false)
    expect(body.isEnabled()).toBe(false)
    // Nothing touches it while it is carried, however long.
    for (let i = 0; i < 60; i++) {
      world.step()
    }
    expect(body.translation()).toEqual({
      x: 1,
      y: 2,
      z: 3,
    })
    expect(carried.release([0, 1.4, 0], [0, 1.4, 1], false)).toBe(true)
    expect(body.translation().z).toBeCloseTo(1)
    expect(body.isEnabled()).toBe(true)
    expect(body.isDynamic()).toBe(true)
    expect(body.linvel()).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
    // Rapier hands a body’s colliders their state again at its next step.
    world.step()
    for (let i = 0; i < body.numColliders(); i++) {
      expect(body.collider(i).isEnabled()).toBe(true)
    }
  })
  test('the player’s capsule never stands in the way, but a wall stops the prop short of it', () => {
    const player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.2, 0).setUserData({isPlayer: true}))
    world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3), player)
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1.5, 1.8))
    const body = sculpture()
    world.step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    expect(carried.release([0, 1.4, 0], [0, 1.4, 1.45], false)).toBe(true)
    const {z} = body.translation()
    // The prop’s cover reaches 0.45 m ahead of its middle and the wall’s face is at 1.7 m, so it stops 1.25 m out, short of the 1.45 m it was held at.
    expect(z).toBeLessThan(1.7 - 0.45)
    expect(z).toBeGreaterThan(1.2)
    expect(carried.placement.hasRoom([0, 1.4, z])).toBe(true)
    expect(body.isEnabled()).toBe(true)
  })
  test('without room nearby, the prop remains disabled in hand until a later release fits', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 2).setTranslation(0, 1.4, 0))
    const body = sculpture()
    world.step()
    const resting = body.translation()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    expect(carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)).toBe(false)
    expect(body.translation()).toEqual(resting)
    expect(body.isEnabled()).toBe(false)
    expect(bodyThrow(body)).toBeUndefined()
    expect(carried.active).toBe(true)
    expect(carried.release([0, 5, 4], [0, 5, 5], false)).toBe(true)
    expect(body.translation().z).toBeCloseTo(5)
    expect(carried.active).toBe(false)
  })
  test('a throw flies along the line it was held on, spinning, and a drop just falls', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)
    expect(body.linvel().x).toBe(0)
    expect(body.linvel().y).toBeCloseTo(launchSpeed(itemMass(body)) / 6, 5)
    expect(body.linvel().z).toBeCloseTo(launchSpeed(itemMass(body)), 5)
    expect(body.angvel().x).toBeCloseTo(launchSpeed(itemMass(body)) / 4, 5)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, -1.45], false)
    expect(body.linvel()).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
    expect(body.translation().z).toBeCloseTo(-1.45, 6)
  })
  test('a prop held low in the view is thrown where the view looks, not along its lower line', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.2, 0.5], true, [0, 0, 1])
    expect(body.translation().z).toBeCloseTo(0.5, 6)
    expect(body.linvel().x).toBe(0)
    expect(body.linvel().y).toBeCloseTo(launchSpeed(itemMass(body)) / 6, 5)
    expect(body.linvel().z).toBeCloseTo(launchSpeed(itemMass(body)), 5)
  })
  test('released fixed props come loose with all their colliders', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(1, 2, 3))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setEnabled(false), body)
    const attached: Array<boolean> = []
    const carried = new GrabbableBody(body, world, {onAttachmentChange: value => attached.push(value)})
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], false)
    expect(body.isDynamic()).toBe(true)
    expect(body.collider(0).isEnabled()).toBe(true)
    expect(attached).toEqual([false])
  })
  test('each deliberate throw gets one stable attack identity until the prop is grabbed again', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    expect(bodyThrow(body)).toBeUndefined()
    expect(carried.grab()).toBe(true)
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)
    const first = bodyThrow(body)
    expect(first?.id).toBeGreaterThan(0)
    expect(bodyThrow(body)).toBe(first)
    expect(carried.grab()).toBe(true)
    expect(bodyThrow(body)).toBeUndefined()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)
    const second = bodyThrow(body)
    expect(second?.id).toBeGreaterThan(first!.id)
    expect(carried.grab()).toBe(true)
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], false)
    expect(bodyThrow(body)).toBeUndefined()
  })
  test('a redundant release after a completed throw does not stop or teleport the prop', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)
    for (let i = 0; i < 5; i++) {
      world.step()
    }
    const before = body.translation()
    const velocity = body.linvel()
    expect(carried.release([0, 1.4, 0], [0, 1.4, 1], false)).toBe(false)
    expect(body.translation()).toEqual(before)
    expect(body.linvel()).toEqual(velocity)
  })
})
