import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Quaternion} from 'three/webgpu'

import {interacts, playerCollisionGroups} from '../../src/lib/physics/collisionGroups.ts'
import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import PlayerGrace, {graceTime} from '../../src/lib/physics/PlayerGrace.ts'
import {throwSpeed, throwSpeedFor} from '../../src/lib/physics/throwMotion.ts'
import {bodyThrow} from '../../src/lib/physics/ThrowState.ts'
import {orbMass} from '../../src/orbs/index.ts'

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
/** a dynamic box with two colliders, like a sculpture with a cover, as heavy as an orb */
const sculpture = () => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1, 2, 3))
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.05, 0.4).setMass(orbMass - 0.3), body)
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.35, 0.01, 0.45).setTranslation(0, 0.06, 0).setMass(0.3), body)
  return body
}
/** the player’s capsule, standing with its feet at `feet`, in its own collision group like in the game */
const player = (feet: [number, number, number] = [0, 0, 0]) => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...feet).setUserData({isPlayer: true}))
  world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(0, 0.85, 0).setCollisionGroups(playerCollisionGroups), body)
  return body
}
/** Steps the world and every grace as the game does, `steps` times. */
const step = (steps = 1) => {
  for (let i = 0; i < steps; i++) {
    world.step()
    PlayerGrace.step(world, world.timestep)
  }
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
  test('a carried prop leaves the physics where it lay, and canceling puts it back in untouched', () => {
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
    carried.cancel()
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
    player()
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1.5, 1.8))
    const body = sculpture()
    world.step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    expect(carried.release([0, 1.4, 0], [0, 1.4, 1.45])?.throwing).toBe(false)
    const {z} = body.translation()
    // The prop’s cover reaches 0.45 m ahead of its middle and the wall’s face is at 1.7 m, so it stops 1.25 m out, short of the 1.45 m it was held at.
    expect(z).toBeLessThan(1.7 - 0.45)
    expect(z).toBeGreaterThan(1.2)
    expect(carried.placement.hasRoom([0, 1.4, z])).toBe(true)
    expect(body.isEnabled()).toBe(true)
  })
  test('without room anywhere along the way, the prop still leaves the hand near it, never teleporting back where it was picked up', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 2).setTranslation(0, 1.4, 0))
    const body = sculpture()
    world.step()
    const resting = body.translation()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    expect(carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})?.throwing).toBe(true)
    expect(body.translation()).not.toEqual(resting)
    expect(Math.hypot(body.translation().x, body.translation().y - 1.4, body.translation().z)).toBeLessThan(1.5)
    expect(body.isEnabled()).toBe(true)
    expect(bodyThrow(body)).toBeDefined()
    expect(carried.active).toBe(false)
  })
  test('a prop held into a wall is pushed out of it on the near side and thrown from there', () => {
    // The wall’s face is 0.3 m ahead of the hand; the sculpture reaches 0.45 m ahead of its middle, so it is in the wall wherever along the line it is let go of.
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1.4, 0.4))
    player()
    const body = sculpture()
    world.step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    const {x, y, z} = body.translation()
    expect(carried.placement.hasRoom([x, y, z], false)).toBe(true)
    expect(z + 0.45).toBeLessThanOrEqual(0.3 + 0.001)
    expect(body.linvel().z).toBeGreaterThan(9)
    // It strikes the wall and bounces back, rather than tunneling through it or jumping somewhere else.
    step(30)
    expect(body.translation().z).toBeLessThan(0.3)
  })
  test('a throw flies along the line it was held on, spinning, and a drop standing still just falls', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    expect(carried.mass).toBeCloseTo(orbMass, 5)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    expect(body.linvel().x).toBeCloseTo(0, 6)
    expect(body.linvel().y).toBeCloseTo(2, 5)
    expect(body.linvel().z).toBeCloseTo(throwSpeed, 5)
    expect(body.angvel().x).toBeCloseTo(3, 5)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, -1.45])
    expect(body.linvel()).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
    expect(body.angvel()).toEqual({
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
    carried.release([0, 1.4, 0], [0, 1.2, 0.5], {
      throwing: true,
      direction: [0, 0, 1],
    })
    expect(body.translation().z).toBeCloseTo(0.5, 6)
    expect(body.linvel().y).toBeCloseTo(2, 5)
    expect(body.linvel().z).toBeCloseTo(throwSpeed, 5)
  })
  test('a drop on the run flies on with the player like a little throw, a throw on the run harder', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.1, 40).setTranslation(0, -0.1, 0))
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    const dropped = carried.release([0, 1.4, 0], [0, 1.2, 0.6], {carrier: [0, 0, 9]})!
    expect(dropped.throwing).toBe(false)
    expect(body.linvel().z).toBeCloseTo(9, 5)
    expect(body.angvel().x).toBeGreaterThan(0)
    step(120)
    // Straight down from 1.2 m would land at 0.6 m; carried along at a sprint, it lands meters ahead.
    expect(body.translation().z).toBeGreaterThan(3)
    carried.grab()
    const thrown = carried.release([0, 1.4, 0], [0, 1.2, 0.6], {
      carrier: [0, 0, 9],
      direction: [0, 0, 1],
      throwing: true,
    })!
    expect(thrown.drive).toBeCloseTo(1, 5)
    expect(body.linvel().z).toBeGreaterThan(throwSpeed + 9)
  })
  test('a prop let go of inside the player’s capsule passes through it until it is clear of it, and only the player', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.1, 40).setTranslation(0, -0.1, 0))
    const capsule = player()
    const body = sculpture()
    step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    // Looking straight down, it is let go of where the player stands.
    carried.release([0, 1.4, 0], [0, 0.4, 0.05])
    expect(carried.grace.active).toBe(true)
    for (let i = 0; i < body.numColliders(); i++) {
      expect(interacts(body.collider(i).collisionGroups(), playerCollisionGroups)).toBe(false)
    }
    step(Math.ceil(graceTime / world.timestep) + 30)
    // It fell through the player’s capsule onto the floor without being shoved out of it, and lies there inside it as long as the player stands on it.
    expect(Math.hypot(body.translation().x, body.translation().z - 0.05)).toBeLessThan(0.05)
    expect(body.translation().y).toBeLessThan(0.2)
    expect(carried.grace.active).toBe(true)
    // Once the player stepped off, it bumps into the player again.
    capsule.setTranslation({
      x: 2,
      y: 0,
      z: 0,
    }, true)
    step(2)
    expect(carried.grace.active).toBe(false)
    for (let i = 0; i < body.numColliders(); i++) {
      expect(interacts(body.collider(i).collisionGroups(), playerCollisionGroups)).toBe(true)
    }
  })
  test('the player walks on through a prop just dropped at its feet, which stays where it fell', () => {
    world.timestep = 1 / 60
    world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.1, 40).setTranslation(0, -0.1, 0))
    const capsule = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.02, 0).setUserData({isPlayer: true}))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(0, 0.85, 0), capsule)
    const motor = new EgoMotor(RAPIER, world, capsule, collider, {collisionGroups: playerCollisionGroups})
    // Walking along −z, the view’s forward.
    const view = new Quaternion
    let highest = 0
    const walk = (steps: number) => {
      for (let i = 0; i < steps; i++) {
        motor.step(world.timestep, {forward: true}, view)
        world.step()
        PlayerGrace.step(world, world.timestep)
        highest = Math.max(highest, capsule.translation().y)
      }
    }
    try {
      walk(30)
      // a box as heavy as an orb, too tall to step over and light enough to shove along
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1, 2, 3))
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setMass(orbMass), body)
      const carried = new GrabbableBody(body, world)
      carried.grab()
      const feet = capsule.translation()
      const {velocity} = motor.getState()
      // Looking down at its feet, it lets go of the prop right where it walks.
      carried.release([feet.x, feet.y + 1.4, feet.z], [feet.x, feet.y + 0.3, feet.z - 0.1], {carrier: [velocity.x, velocity.y, velocity.z]})
      expect(carried.grace.active).toBe(true)
      walk(90)
      // Without the grace, the player would shove the box along all the way, or climb over a flat prop.
      expect(highest).toBeLessThan(0.04)
      expect(capsule.translation().z).toBeLessThan(feet.z - 4.3)
      expect(body.translation().z).toBeGreaterThan(capsule.translation().z + 2)
      expect(Math.abs(body.linvel().z)).toBeLessThan(0.05)
      // It carried on a little with the walk’s momentum before coming to rest.
      expect(body.translation().z).toBeLessThan(feet.z - 0.3)
      // It bumps into the player again now that it is behind.
      expect(carried.grace.active).toBe(false)
    } finally {
      motor.dispose()
    }
  })
  test('the grace runs out after its time when the prop is clear of the player, and grabbing again ends it', () => {
    player()
    const body = sculpture()
    step()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    expect(carried.grace.active).toBe(true)
    step(Math.floor(graceTime / world.timestep) - 1)
    expect(carried.grace.active).toBe(true)
    step(2)
    expect(carried.grace.active).toBe(false)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    expect(carried.grace.active).toBe(true)
    carried.grab()
    expect(carried.grace.active).toBe(false)
    expect(interacts(body.collider(0).collisionGroups(), playerCollisionGroups)).toBe(true)
  })
  test('heavier and lighter props than an orb fly shorter', () => {
    expect(throwSpeedFor(orbMass)).toBeCloseTo(throwSpeed, 9)
    const body = sculpture()
    body.collider(0).setMass(4.2)
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    expect(body.linvel().z).toBeCloseTo(throwSpeedFor(4.5), 5)
    expect(body.linvel().z).toBeLessThan(throwSpeed * 0.8)
  })
  test('released fixed props come loose with all their colliders', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(1, 2, 3))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.1, 0.1).setEnabled(false), body)
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.cancel()
    expect(body.isFixed()).toBe(true)
    expect(body.collider(0).isEnabled()).toBe(false)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45])
    expect(body.isDynamic()).toBe(true)
    expect(body.collider(0).isEnabled()).toBe(true)
  })
  test('each deliberate throw gets one stable attack identity until the prop is grabbed again', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    expect(bodyThrow(body)).toBeUndefined()
    expect(carried.grab()).toBe(true)
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    const first = bodyThrow(body)
    expect(first?.id).toBeGreaterThan(0)
    expect(bodyThrow(body)).toBe(first)
    expect(carried.grab()).toBe(true)
    expect(bodyThrow(body)).toBeUndefined()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    const second = bodyThrow(body)
    expect(second?.id).toBeGreaterThan(first!.id)
    expect(carried.grab()).toBe(true)
    carried.release([0, 1.4, 0], [0, 1.4, 1.45])
    expect(bodyThrow(body)).toBeUndefined()
  })
  test('cancel after a completed throw does not stop or teleport the prop', () => {
    const body = sculpture()
    const carried = new GrabbableBody(body, world)
    carried.grab()
    carried.release([0, 1.4, 0], [0, 1.4, 1.45], {throwing: true})
    for (let i = 0; i < 5; i++) {
      world.step()
    }
    const before = body.translation()
    const velocity = body.linvel()
    carried.cancel()
    expect(body.translation()).toEqual(before)
    expect(body.linvel()).toEqual(velocity)
  })
})
