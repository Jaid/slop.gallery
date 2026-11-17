import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import throwVoices from '../../src/lib/audio/throwVoices.ts'
import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import {handSpeed, itemMotion} from '../../src/lib/physics/itemMotion.ts'
import ItemRelease from '../../src/lib/physics/ItemRelease.ts'
import {playerCollisionGroups} from '../../src/lib/physics/PlayerReleaseGrace.ts'
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
const aim: Vec3 = [0, 0, 1]
const orb = (mass = 1.8) => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(8, 1.4, 3).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.ball(0.14).setMass(mass), body)
  return body
}
const player = () => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 0).setUserData({isPlayer: true}))
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3).setCollisionGroups(playerCollisionGroups), body)
  return {
    body,
    collider,
  }
}
const steps = (release: ItemRelease, count: number) => {
  for (let i = 0; i < count; i++) {
    release.grace.step(world.timestep)
    world.step()
  }
}
const range = (mass: number) => {
  const {velocity: [x, y, z]} = itemMotion(mass, aim, true)
  const seconds = (y + Math.sqrt(y * y + 2 * 9.81 * 1.4)) / 9.81
  return Math.hypot(x, z) * seconds
}
describe('throw weight and player momentum', () => {
  test('both mass extremes have less range than a comfortable weight, with a smooth bounded peak', () => {
    expect(handSpeed(1.8)).toBe(10)
    expect(handSpeed(0)).toBe(0)
    let previous = 0
    for (const mass of [0.001, 0.01, 0.1, 0.3, 1, 1.8]) {
      expect(handSpeed(mass)).toBeGreaterThan(previous)
      previous = handSpeed(mass)
    }
    for (const mass of [3, 10, 30, 100, 1000]) {
      expect(handSpeed(mass)).toBeLessThan(previous)
      previous = handSpeed(mass)
    }
    expect(range(0.008)).toBeLessThan(range(1.8) * 0.2)
    expect(range(30)).toBeLessThan(range(1.8) * 0.5)
  })
  test('a sprint drives a throw forward, a sidestep stays sideways and a jump makes a higher arc', () => {
    const standing = itemMotion(1.8, aim, true)
    const sprinting = itemMotion(1.8, aim, true, [0, 0, 9])
    const rising = itemMotion(1.8, aim, true, [0, 5, 0])
    const sideways = itemMotion(1.8, aim, true, [9, 0, 0])
    expect(sprinting.velocity[2]).toBeGreaterThan(standing.velocity[2] + 9)
    expect(rising.velocity[1]).toBeGreaterThan(standing.velocity[1] + 5)
    expect(sideways.velocity).toEqual([9, standing.velocity[1], standing.velocity[2]])
    expect(itemMotion(1.8, aim, true, [0, -4, 0]).velocity[1]).toBe(-2)
    expect(itemMotion(1.8, aim, true, [0, 0, -3]).velocity[2]).toBe(7)
    expect(itemMotion(1.8, [0, 1, 0], true, [0, 0, 9]).velocity.every(Number.isFinite)).toBe(true)
  })
  test('drops inherit all momentum with no hand impulse, loft, spin or fusion identity', () => {
    const body = orb()
    const held = new GrabbableBody(body, world)
    held.grab()
    const motion = held.release([0, 1.4, 0], [0, 1.4, 0.5], false, aim, [2, 3, 5])!
    expect(motion.velocity).toEqual([2, 3, 5])
    expect(body.linvel()).toEqual({
      x: 2,
      y: 3,
      z: 5,
    })
    expect(body.angvel()).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
    expect(bodyThrow(body)).toBeUndefined()
    steps(held.releaseBody, 5)
    expect(body.translation().x).toBeGreaterThan(0.1)
    expect(body.translation().z).toBeGreaterThan(0.8)
  })
  test('a stationary drop explicitly wakes a sleeping prop so gravity can take it', () => {
    const body = orb()
    const held = new GrabbableBody(body, world)
    body.sleep()
    held.grab()
    body.sleep()
    expect(held.release([0, 1.4, 0], [0, 1.4, 0.5], false)).not.toBeNull()
    expect(body.isSleeping()).toBe(false)
    steps(held.releaseBody, 20)
    expect(body.translation().y).toBeLessThan(1.2)
  })
  test('a massless attached body uses every released collider’s authored mass', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(RAPIER.ColliderDesc.ball(0.1).setMass(0.005).setEnabled(false), body)
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.02, 0.3, 0.02).setMass(0.003).setEnabled(false), body)
    world.step()
    expect(body.mass()).toBe(0)
    const held = new GrabbableBody(body, world)
    held.grab()
    world.step()
    const motion = held.release([0, 1.4, 0], [0, 1.4, 0.5], true)!
    expect(motion.mass).toBeCloseTo(0.008)
    expect(body.linvel().z).toBeCloseTo(handSpeed(0.008), 6)
  })
})
describe('player-only release grace', () => {
  test.each([false, true])('release inside the capsule succeeds without an explosive collision (throwing %s)', throwing => {
    player()
    const body = orb()
    const held = new GrabbableBody(body, world)
    world.step()
    held.grab()
    world.step()
    expect(held.release([0, 1.4, 0], [0, 1.4, 0.12], throwing)).not.toBeNull()
    expect(body.translation().z).toBeCloseTo(0.12)
    steps(held.releaseBody, 5)
    expect(Math.hypot(body.linvel().x, body.linvel().y, body.linvel().z)).toBeLessThan(11)
    expect(body.translation().x).toBeCloseTo(0, 5)
    expect(body.translation().z).toBeGreaterThanOrEqual(0.119)
  })
  test('grace masks the KCC’s movement query too, and restores the exact groups only after separation', () => {
    world.gravity.y = 0
    const {collider} = player()
    const body = orb()
    const itemCollider = body.collider(0)
    const original = itemCollider.collisionGroups()
    const held = new GrabbableBody(body, world)
    world.step()
    held.grab()
    held.release([0, 1.4, 0], [0, 1.4, 0.1], false)
    steps(held.releaseBody, 30)
    // A timeout must not blindly re-enable an overlapping pair.
    expect(itemCollider.collisionGroups()).not.toBe(original)
    const controller = world.createCharacterController(0.01)
    controller.computeColliderMovement(collider, {
      x: 0,
      y: 0,
      z: 0.5,
    }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, playerCollisionGroups)
    expect(controller.computedMovement().z).toBeCloseTo(0.5, 4)
    body.setTranslation({
      x: 0,
      y: 1.4,
      z: 1,
    }, true)
    world.step()
    steps(held.releaseBody, 1)
    expect(itemCollider.collisionGroups()).toBe(original)
    // Now the same capsule can be stopped by the item again.
    controller.computeColliderMovement(collider, {
      x: 0,
      y: 0,
      z: 1.2,
    }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, playerCollisionGroups)
    expect(controller.computedMovement().z).toBeLessThan(0.9)
    world.removeCharacterController(controller)
  })
  test('even an already-separated item keeps the minimum 0.2 s of grace; re-grabbing clears it', () => {
    player()
    const body = orb()
    const groups = body.collider(0).collisionGroups()
    const held = new GrabbableBody(body, world)
    world.step()
    held.grab()
    held.release([0, 1.4, 0], [0, 1.4, 1], true)
    steps(held.releaseBody, 5)
    expect(body.collider(0).collisionGroups()).not.toBe(groups)
    steps(held.releaseBody, 10)
    expect(body.collider(0).collisionGroups()).toBe(groups)
    held.grab()
    held.release([0, 1.4, 0], [0, 1.4, 0.1], false)
    expect(body.collider(0).collisionGroups()).not.toBe(groups)
    held.grab()
    expect(body.collider(0).collisionGroups()).toBe(groups)
  })
  test('player sensors do not prolong grace, and replaced colliders do not leave invalid contact queries', () => {
    const {body: playerBody} = player()
    world.createCollider(RAPIER.ColliderDesc.ball(20).setSensor(true), playerBody)
    const body = orb()
    const groups = body.collider(0).collisionGroups()
    const held = new GrabbableBody(body, world)
    world.step()
    held.grab()
    held.release([0, 1.4, 0], [0, 1.4, 1], false)
    steps(held.releaseBody, 20)
    expect(body.collider(0).collisionGroups()).toBe(groups)
    held.grab()
    held.release([0, 1.4, 0], [0, 1.4, 0.1], false)
    world.removeCollider(body.collider(0), true)
    expect(() => steps(held.releaseBody, 20)).not.toThrow()
  })
  test('grace never disables a thin wall, floor, or unrelated kinematic obstacle', () => {
    player()
    const body = orb()
    world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0))
    const wall = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0.7))
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.025), wall)
    const held = new GrabbableBody(body, world)
    world.step()
    held.grab()
    held.release([0, 1.4, 0], [0, 1.4, 1], true)
    expect(body.translation().z).toBeLessThan(0.54)
    steps(held.releaseBody, 60)
    expect(body.translation().z).toBeLessThan(0.55)
    expect(body.translation().y).toBeGreaterThan(0.1)
  })
})
describe('collision-safe full-shape releases', () => {
  test('an intersecting start cannot escape out the far side of a thin wall', () => {
    const body = orb()
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.02).setTranslation(0, 1.4, 0))
    world.step()
    const held = new GrabbableBody(body, world)
    held.grab()
    expect(held.placement.hasRoom([0, 1.4, 1], false)).toBe(true)
    expect(held.release([0, 1.4, 0], [0, 1.4, 1], true)).toBeNull()
    expect(held.active).toBe(true)
    expect(body.isEnabled()).toBe(false)
    expect(bodyThrow(body)).toBeUndefined()
    expect(held.release([1, 1.4, -0.4], [1, 1.4, -1], true)).not.toBeNull()
    expect(body.translation().z).toBeCloseTo(-1)
  })
  test('an offset, rotated portrait uses the same sweep and velocity as other items', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(9, 2, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.6, 0.4, 0.04).setTranslation(0, 0, 0.06).setMass(2), body)
    body.setRotation({
      x: 0,
      y: Math.SQRT1_2,
      z: 0,
      w: Math.SQRT1_2,
    }, false)
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1, 1.1))
    world.step()
    const release = new ItemRelease(body, world)
    const motion = release.release([0, 1.4, 0], [0, 1.4, 1.1], true, aim, [0, 3, 4])!
    expect(body.translation().z).toBeLessThan(0.4)
    expect(body.isDynamic()).toBe(true)
    expect(motion.velocity).toEqual(itemMotion(2, aim, true, [0, 3, 4]).velocity)
    expect(body.linvel().y).toBeCloseTo(motion.velocity[1], 6)
  })
})
test('release sound follows weight, speed and loft, with quieter moving drops', () => {
  const standing = throwVoices(itemMotion(1.8, aim, true))
  const sprint = throwVoices(itemMotion(1.8, aim, true, [0, 0, 9]))
  const jump = throwVoices(itemMotion(1.8, aim, true, [0, 5, 0]))
  const heavy = throwVoices(itemMotion(30, aim, true))
  const dropped = throwVoices(itemMotion(1.8, aim, false))
  const movingDrop = throwVoices(itemMotion(1.8, aim, false, [0, 0, 9]))
  expect(sprint[0]).not.toEqual(standing[0])
  expect(jump[0].duration).toBeGreaterThan(standing[0].duration)
  expect(heavy[1].kind === 'oscillator' && heavy[1].frequency).toBeLessThan(standing[1].kind === 'oscillator' ? standing[1].frequency : 0)
  expect(dropped[0].volume).toBeLessThan(standing[0].volume)
  expect(movingDrop[0].volume).toBeGreaterThan(dropped[0].volume)
  for (const voices of [standing, sprint, jump, heavy, dropped, movingDrop]) {
    for (const voice of voices) {
      expect(voice.volume).toBeGreaterThan(0)
      expect(voice.volume).toBeLessThan(0.05)
      expect(voice.duration).toBeGreaterThan(0)
      expect(voice.duration).toBeLessThan(0.4)
    }
  }
})
