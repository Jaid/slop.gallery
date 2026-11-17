import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import {playerCollisionGroups} from '../../src/lib/physics/playerCollision.ts'
import {throwMotion, throwStrength, throwTone} from '../../src/lib/physics/throwMotion.ts'
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
  test('a carried prop stays out of physics until released at the hand', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    expect(carried.grab()).toBe(true)
    expect(carried.grab()).toBe(false)
    expect(body.isEnabled()).toBe(false)
    for (let i = 0; i < 60; i++) {
      world.step()
    }
    carried.release([0, 1.4, 0], [0, 1.4, 1], false)
    expect(body.isEnabled()).toBe(true)
    expect(body.translation().z).toBeCloseTo(1)
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
  test('without room, it is released near the player instead of returning home', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 2).setTranslation(0, 1.4, 0))
    const body = sculpture()
    world.step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)
    expect(body.translation().z).toBeCloseTo(0)
    expect(body.isEnabled()).toBe(true)
    expect(bodyThrow(body)).toBeDefined()
    expect(carried.active).toBe(false)
  })
  test('a throw flies along the line it was held on, spinning, and a drop just falls', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)
    const speed = throwStrength(body.collider(0).mass() + body.collider(1).mass())
    expect(body.linvel().z).toBeCloseTo(speed)
    expect(body.linvel().y).toBeCloseTo(speed * 0.2)
    expect(body.angvel().x).toBe(3)
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
    const speed = throwStrength(body.collider(0).mass() + body.collider(1).mass())
    expect(body.linvel().z).toBeCloseTo(speed)
    expect(body.linvel().y).toBeCloseTo(speed * 0.2)
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
  test('releasing again after a completed throw does not stop or teleport the prop', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], true)
    for (let i = 0; i < 5; i++) {
      world.step()
    }
    const before = body.translation()
    const velocity = body.linvel()
    carried.release([0, 0, 0], [0, 0, 1], false)
    expect(body.translation()).toEqual(before)
    expect(body.linvel()).toEqual(velocity)
  })
})
describe('throw motion', () => {
  test('light and heavy extremes fly less far than a hand-sized object', () => {
    expect(throwStrength(0.01)).toBeLessThan(throwStrength(0.35))
    expect(throwStrength(0.35)).toBeLessThan(throwStrength(1.8))
    expect(throwStrength(100)).toBeLessThan(throwStrength(4.5))
    expect(throwStrength(4.5)).toBeLessThan(throwStrength(1.8))
  })
  test('movement is inherited on drops and adds forward speed and loft to throws', () => {
    const rest = throwMotion(1.8, [0, 0, 1], [0, 0, 0], true)
    const running = throwMotion(1.8, [0, 0, 1], [0, 4, 6], true)
    expect(running[2]).toBeGreaterThan(rest[2])
    expect(running[1]).toBeGreaterThan(rest[1] + 4)
    expect(throwMotion(1.8, [0, 0, 1], [1, -2, 3], false)).toEqual([1, -2, 3])
    expect(throwTone(1.8, running)).toBeGreaterThan(throwTone(1.8, rest))
    expect(throwTone(10, rest)).toBeLessThan(throwTone(1, rest))
  })
  test('releasing a carried body inherits the carrier’s motion on both drop and throw', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 2, 0], [0, 2, 1], false, [0, 0, 1], [1, 2, 3])
    expect(body.linvel()).toEqual({
      x: 1,
      y: 2,
      z: 3,
    })
    expect(bodyThrow(body)).toBeUndefined()
    carried.grab()
    carried.release([0, 2, 0], [0, 2, 1], true, [0, 0, 1], [1, 2, 3])
    expect(body.linvel().x).toBeCloseTo(1)
    expect(body.linvel().y).toBeGreaterThan(2.6)
    expect(body.linvel().z).toBeGreaterThan(3)
    expect(bodyThrow(body)).toBeDefined()
  })
  test('player grace keeps walls solid and ends only after separation', () => {
    const player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.4, 0).setUserData({isPlayer: true}))
    world.createCollider(RAPIER.ColliderDesc.capsule(0.4, 0.3).setCollisionGroups(playerCollisionGroups), player)
    const body = sculpture()
    world.step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 0.1], false)
    expect(body.translation().z).toBeCloseTo(0.1)
    expect(body.collider(0).collisionGroups() & 0x80_00).toBe(0)
    carried.playerGrace.update(1)
    expect(body.collider(0).collisionGroups() & 0x80_00).toBe(0)
    body.setTranslation({
      x: 0,
      y: 1.4,
      z: 2,
    }, true)
    carried.playerGrace.update(0.01)
    expect(body.collider(0).collisionGroups() & 0x80_00).not.toBe(0)
  })
  test('the released body is not deflected by the player but still hits a wall', () => {
    const player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.4, 0).setUserData({isPlayer: true}))
    world.createCollider(RAPIER.ColliderDesc.capsule(0.4, 0.3).setCollisionGroups(playerCollisionGroups), player)
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1.4, 2))
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(3, 1, 0).setCcdEnabled(true))
    world.createCollider(RAPIER.ColliderDesc.ball(0.14).setMass(1.8), body)
    world.step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 0.1], true, [0, 0, 1])
    for (let i = 0; i < 30; i++) {
      world.step()
      carried.playerGrace.update(1 / 60)
    }
    expect(body.translation().z).toBeGreaterThan(1)
    expect(body.translation().z).toBeLessThan(1.9)
    expect(body.collider(0).collisionGroups() & 0x80_00).not.toBe(0)
  })
  test('a release inside a wall is physically pushed free, without returning to its old position', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1.4, 0))
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(4, 1, 0))
    world.createCollider(RAPIER.ColliderDesc.ball(0.14).setMass(1.8), body)
    world.step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1], false)
    for (let i = 0; i < 30; i++) {
      world.step()
    }
    expect(Math.abs(body.translation().z)).toBeGreaterThan(0.2)
    expect(body.translation().x).toBeCloseTo(0)
  })
})
