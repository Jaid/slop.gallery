import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Quaternion, Vector3} from 'three/webgpu'

import throwVoices from '../../src/lib/audio/throwVoices.ts'
import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import {itemLaunch, itemMass, launchSpeed} from '../../src/lib/physics/itemLaunch.ts'
import ReleaseGrace, {playerCollisionGroups} from '../../src/lib/physics/ReleaseGrace.ts'
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
const step = (count = 1) => {
  for (let i = 0; i < count; i++) {
    ReleaseGrace.for(world).step(world)
    world.step()
  }
}
const item = (mass = 0.9) => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(8, 2, 8).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.ball(0.14).setMass(mass), body)
  return new GrabbableBody(body, world)
}
const player = () => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0).setUserData({isPlayer: true}))
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.3).setCollisionGroups(playerCollisionGroups), body)
  return {
    body,
    collider,
  }
}
const expectVector = (actual: RAPIER.Vector, values: Vec3) => {
  for (const [i, axis] of ['x', 'y', 'z'].entries()) {
    expect(actual[axis as keyof RAPIER.Vector]).toBeCloseTo(values[i], 5)
  }
}
describe('weight and carrier momentum', () => {
  test('light foliage and heavy objects have shorter airborne ranges than hand-sized weights', () => {
    const distances: Array<number> = []
    for (const mass of [0.005, 0.9, 60]) {
      const prop = item(mass)
      prop.grab()
      expect(prop.release([0, 1.4, 0], [0, 1.4, 0.6], true, [0, 0, 1])).toBe(true)
      for (let i = 0; i < 300 && prop.body.translation().y > 0.14; i++) {
        step()
      }
      distances.push(prop.body.translation().z - 0.6)
      world.removeRigidBody(prop.body)
    }
    expect(distances[1]).toBeGreaterThan(8)
    expect(distances[0]).toBeLessThan(distances[1] * 0.25)
    expect(distances[2]).toBeLessThan(distances[1] * 0.3)
  })
  test('fixed compound objects use their real collider mass, including disabled foliage', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(RAPIER.ColliderDesc.ball(0.1).setMass(0.008).setEnabled(false), body)
    world.createCollider(RAPIER.ColliderDesc.ball(0.03).setMass(0.002).setEnabled(false), body)
    expect(itemMass(body)).toBeCloseTo(0.01)
    const prop = new GrabbableBody(body, world)
    prop.grab()
    prop.release([0, 1.4, 0], [0, 1.4, 0.6], true, [0, 0, 1])
    expect(prop.body.linvel().z).toBeCloseTo(launchSpeed(0.01), 5)
  })
  test.each([
    ['still', [0, 0, 0]],
    ['sprinting forward', [0, 0, 9]],
    ['backward', [0, 0, -3]],
    ['strafing', [3, 0, 0]],
    ['rising', [0, 6, 3]],
    ['falling', [0, -5, 3]],
  ] as Array<[string, Vec3]>)('%s adds actual motion to throws and drops', (_, velocity) => {
    const prop = item()
    for (const throwing of [true, false]) {
      prop.grab()
      expect(prop.release([0, 1.4, 0], [0, 1.4, 0.6], throwing, [0, 0, 1], velocity)).toBe(true)
      expectVector(prop.body.linvel(), [velocity[0], velocity[1] + (throwing ? 2 : 0), velocity[2] + (throwing ? 12 : 0)])
      expect(!!bodyThrow(prop.body)).toBe(throwing)
    }
  })
  test('jump throws rise higher, forward sprints fly farther and moving drops really travel', () => {
    const trajectories = [[0, 0, 0], [0, 6, 0], [0, 0, 9]] as Array<Vec3>
    const ends = trajectories.map(velocity => {
      const prop = item()
      prop.grab()
      prop.release([0, 1.4, 0], [0, 1.4, 0.6], true, [0, 0, 1], velocity)
      step(24)
      const end = prop.body.translation()
      world.removeRigidBody(prop.body)
      return end
    })
    expect(ends[1].y - ends[0].y).toBeCloseTo(2.4, 3)
    expect(ends[2].z - ends[0].z).toBeCloseTo(3.6, 3)
    const prop = item()
    prop.grab()
    prop.release([0, 1.4, 0], [0, 1.4, 0.6], false, [0, 0, 1], [0, 0, 9])
    step(20)
    expect(prop.body.translation().z).toBeGreaterThan(3)
    expect(prop.body.translation().y).toBeLessThan(1.4)
  })
  test('aim normalization and vertical throws stay finite', () => {
    for (const direction of [[0, 0, 0], [0, 100, 0], [0, -100, 0], [100, 0, 0]] as Array<Vec3>) {
      for (const mass of [0, 0.001, 1, 1000]) {
        const launch = itemLaunch(mass, direction, [0, 0, 0], true)
        expect(launch.velocity.every(Number.isFinite)).toBe(true)
        expect(Math.hypot(...launch.velocity)).toBeLessThan(14.01)
      }
    }
  })
})
describe('local hand clearance', () => {
  test.each([true, false])('release against a wall can overlap the player, throwing=%s', throwing => {
    const avatar = player()
    world.createCollider(RAPIER.ColliderDesc.cuboid(3, 3, 0.05).setTranslation(0, 1, 0.5))
    const prop = item()
    step()
    prop.grab()
    expect(prop.release([0, 1.4, 0], [0, 1.4, 0.6], throwing, [0, 0, 1])).toBe(true)
    expect(prop.body.translation().z).toBeLessThan(0.31)
    expect(prop.body.translation().z).toBeGreaterThan(0.25)
    expect(prop.placement.hasRoom(Object.values(prop.body.translation()) as Vec3, false)).toBe(true)
    expect(avatar.collider.contactShape(prop.body.collider(0).shape, prop.body.translation(), prop.body.rotation(), 0)?.distance).toBeLessThan(0)
    step(8)
    expect(prop.body.translation().z).toBeLessThan(0.45)
    expect(avatar.body.translation().z).toBe(0)
  })
  test('a bulky compound item retracts out of the wall locally, keeping the pickup body disabled until release', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.04).setTranslation(0, 1.4, 0.32))
    const prop = item()
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.15, 0.15, 0.25).setTranslation(0, 0.15, 0.2), prop.body)
    step()
    prop.grab()
    const point = prop.placement.reach([0, 1.4, 0], [0, 1.4, 0.6])!
    expect(point).not.toBeNull()
    expect(point[2]).toBeLessThan(-0.17)
    expect(point[2]).toBeGreaterThan(-0.25)
    expect(prop.body.translation().x).toBeCloseTo(8)
    expect(prop.body.isEnabled()).toBe(false)
    expect(prop.release([0, 1.4, 0], [0, 1.4, 0.6], false)).toBe(true)
    expect(prop.body.translation().z).toBeCloseTo(point[2], 4)
  })
  test('a rotating compound item clears the floor, a corner and a low pedestal with every shape', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(4, 0.1, 4).setTranslation(0, -0.1, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(4, 2, 0.05).setTranslation(0, 1, 0.7))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 2, 4).setTranslation(0.55, 1, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.55, 0.2).setTranslation(0, 0.55, 0.55))
    const prop = item()
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.25, 0.3, 0.15).setTranslation(0, -0.2, 0.1), prop.body)
    const rotation = new Quaternion
    prop.body.setRotation(rotation.setFromAxisAngle(new Vector3(0, 1, 0), 0.5), true)
    step()
    prop.grab()
    for (const target of [[0, 1.4, 1.4], [1, 1.4, 1], [0, -1, 0.2]] as Array<Vec3>) {
      const position = prop.placement.reach([0, 1.3, 0], target)!
      expect(position).not.toBeNull()
      expect(prop.placement.hasRoom(position, false)).toBe(true)
      expect(position[2]).toBeLessThan(0.65)
      expect(position[0]).toBeLessThan(0.5)
      expect(position[1]).toBeGreaterThan(0.4)
    }
  })
  test('a thin triangle wall never lets a throw appear on its far side', () => {
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array([-3, -1, 0.4, 3, -1, 0.4, 3, 4, 0.4, -3, 4, 0.4]), new Uint32Array([0, 2, 1, 0, 3, 2])))
    const prop = item()
    step()
    prop.grab()
    expect(prop.release([0, 1.4, 0], [0, 1.4, 1.4], true)).toBe(true)
    expect(prop.body.translation().z).toBeLessThan(0.26)
    step(15)
    expect(prop.body.translation().z).toBeLessThan(0.4)
  })
  test('depenetration never puts an offset shape beyond a thin wall', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.02).setTranslation(0, 1.4, 0.3))
    const prop = item()
    world.createCollider(RAPIER.ColliderDesc.ball(0.2).setTranslation(0, 0, 0.4), prop.body)
    step()
    prop.grab()
    // Its offset ball overlaps the far face. Pushing along that face’s normal would fit, but through the wall.
    expect(prop.release([0, 1.4, 0], [0, 1.4, 0.7], true)).toBe(false)
    expect(prop.active).toBe(true)
    expect(prop.body.isEnabled()).toBe(false)
  })
  test('sensors and disabled bodies do not obstruct a release', () => {
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 2).setSensor(true))
    const obstacle = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setEnabled(false))
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 2), obstacle)
    const prop = item()
    step()
    prop.grab()
    expect(prop.release([0, 1.4, 0], [0, 1.4, 1], false)).toBe(true)
    expect(prop.body.translation().z).toBeCloseTo(1)
  })
})
describe('player-only release grace', () => {
  test('the character controller ignores the released item while walls still block both', () => {
    const avatar = player()
    const prop = item()
    step()
    prop.grab()
    prop.release([0, 1, 0], [0, 1, 0.55], false)
    step()
    const motor = world.createCharacterController(0.01)
    motor.computeColliderMovement(avatar.collider, {
      x: 0,
      y: 0,
      z: 0.7,
    }, undefined, playerCollisionGroups)
    expect(motor.computedMovement().z).toBeCloseTo(0.7)
    world.createCollider(RAPIER.ColliderDesc.cuboid(3, 3, 0.05).setTranslation(0, 1, 0.75))
    step()
    motor.computeColliderMovement(avatar.collider, {
      x: 0,
      y: 0,
      z: 0.7,
    }, undefined, playerCollisionGroups)
    expect(motor.computedMovement().z).toBeLessThan(0.4)
  })
  test('grace lasts a minimum interval, extends for overlap and restores original groups once clear', () => {
    const avatar = player()
    const prop = item()
    const original = prop.body.collider(0).collisionGroups()
    step()
    prop.grab()
    prop.release([0, 1, 0], [0, 1, 0], false)
    prop.body.setGravityScale(0, true)
    step(60)
    expect(prop.body.collider(0).collisionGroups()).toBe((original & ~2) >>> 0)
    expectVector(prop.body.translation(), [0, 1, 0])
    avatar.body.setNextKinematicTranslation({
      x: 2,
      y: 1,
      z: 0,
    })
    step(2)
    expect(prop.body.collider(0).collisionGroups()).toBe(original)
    // Later ordinary contact is back, including the controller’s queries.
    avatar.body.setNextKinematicTranslation({
      x: 0,
      y: 1,
      z: -0.6,
    })
    step()
    const motor = world.createCharacterController(0.01)
    motor.computeColliderMovement(avatar.collider, {
      x: 0,
      y: 0,
      z: 1,
    }, undefined, playerCollisionGroups)
    expect(motor.computedMovement().z).toBeLessThan(0.2)
  })
  test('a re-grab restores custom masks and another release restarts the timer; removed bodies are harmless', () => {
    const prop = item()
    const groups = 0x00_01_FF_FF
    prop.body.collider(0).setCollisionGroups(groups)
    prop.grab()
    prop.release([0, 1.4, 0], [0, 1.4, 0.6], false)
    step(5)
    expect(prop.body.collider(0).collisionGroups()).not.toBe(groups)
    prop.grab()
    expect(prop.body.collider(0).collisionGroups()).toBe(groups)
    prop.release([0, 1.4, 0], [0, 1.4, 0.6], false)
    step(14)
    expect(prop.body.collider(0).collisionGroups()).not.toBe(groups)
    step(2)
    expect(prop.body.collider(0).collisionGroups()).toBe(groups)
    prop.grab()
    prop.release([0, 1.4, 0], [0, 1.4, 0.6], false)
    world.removeRigidBody(prop.body)
    expect(() => step()).not.toThrow()
  })
})
const recipe = (mass: number, velocity: Vec3, throwing = true) => throwVoices({
  mass,
  velocity,
  throwing,
})
test('release sound follows weight, speed and upward arc; drops remain softer', () => {
  const ordinary = recipe(0.9, [0, 2, 12])
  const heavy = recipe(30, [0, 2, 12])
  const fast = recipe(0.9, [0, 2, 21])
  const high = recipe(0.9, [0, 10, 7])
  const drop = recipe(0.9, [0, 0, 9], false)
  expect(heavy[0].duration).toBeGreaterThan(ordinary[0].duration)
  expect(fast[0].volume).toBeGreaterThan(ordinary[0].volume)
  expect(drop[0].volume).toBeLessThan(ordinary[0].volume)
  expect(high).not.toEqual(ordinary)
  for (const voices of [ordinary, heavy, fast, high, drop, recipe(0.001, [0, 0, 0]), recipe(1000, [0, 100, 100])]) {
    for (const voice of voices) {
      expect(voice.duration).toBeGreaterThan(voice.attack!)
      expect(voice.volume).toBeLessThan(0.06)
      expect(voice.duration).toBeLessThanOrEqual(0.25)
    }
  }
})
