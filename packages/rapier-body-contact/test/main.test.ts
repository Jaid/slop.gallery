import type {BodyContact} from '../src/main.ts'

import {expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import {invert, makeRotation, makeVector, multiply, rotate} from '../src/lib/math.ts'
import BodyContacts from '../src/main.ts'

await RAPIER.init()
/** A world stepping like `<Physics>` of @react-three/rapier, with a floor 10 m square whose top lies at 0 and a wall along its east edge in one collider, like a room’s trimesh. */
function physics(options: Partial<ConstructorParameters<typeof BodyContacts<string>>[0]> = {}) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 60
  Object.assign(world.integrationParameters, {
    normalizedAllowedLinearError: 0.001,
    normalizedPredictionDistance: 0.002,
  })
  const room = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0), room)
  // The wall, a collider of its own on the same body.
  const wall = world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 2, 5).setTranslation(5.1, 2, 0), room)
  const contacts: Array<BodyContact<string>> = []
  const sampler = new BodyContacts<string>({
    onContact: contact => contacts.push(contact),
    ...options,
  })
  const step = (count: number) => {
    for (let i = 0; i < count; i++) {
      sampler.capture()
      world.step()
      sampler.collect(world)
    }
  }
  return {
    world,
    room,
    floor,
    wall,
    contacts,
    sampler,
    step,
  }
}
const radius = 0.14
/** a 0.14 m glass ball of 1.8 kg */
function ball(world: RAPIER.World, [x, y, z]: readonly [number, number, number]) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.ball(radius).setMass(1.8).setFriction(0.8).setRestitution(0.32), body)
  return body
}
/** Sets a ball rolling along x at `speed` m/s, spinning as fast as it rolls. */
function roll(body: RAPIER.RigidBody, speed: number) {
  body.setLinvel({
    x: speed,
    y: 0,
    z: 0,
  }, true)
  body.setAngvel({
    x: 0,
    y: 0,
    z: -speed / radius,
  }, true)
}
test('a ball dropped onto the floor strikes it at the speed it fell with, then bounces ever softer until it rests silently', () => {
  const {world, contacts, floor, room, sampler, step} = physics()
  const body = ball(world, [0, 1.3, 0])
  sampler.register(body, 'ball')
  step(240)
  expect(contacts.length).toBeGreaterThanOrEqual(2)
  const [first, second] = contacts
  // 1.16 m of fall
  expect(first.speed).toBeCloseTo(Math.sqrt(2 * 9.81 * 1.16), 0)
  expect(first.normal.y).toBeCloseTo(-1)
  expect(first.point.y).toBeCloseTo(0, 1)
  expect(first.tag).toBe('ball')
  expect(first.body.handle).toBe(body.handle)
  expect(first.collider.handle).toBe(body.collider(0).handle)
  expect(first.other).toBeUndefined()
  expect(first.otherBody?.handle).toBe(room.handle)
  expect(first.otherCollider.handle).toBe(floor.handle)
  expect(second.speed).toBeLessThan(first.speed * 0.3)
  const count = contacts.length
  step(120)
  expect(contacts).toHaveLength(count)
})
test('a ball rolling along the floor strikes the wall it meets, not the floor under it on the way', () => {
  const {world, contacts, sampler, step, wall} = physics()
  const body = ball(world, [0, 0.14, 0])
  sampler.register(body, 'ball')
  step(30)
  contacts.length = 0
  roll(body, 4)
  step(150)
  expect(contacts.length).toBeGreaterThanOrEqual(1)
  const [struck] = contacts
  expect(struck.speed).toBeCloseTo(4, 0)
  expect(struck.point.x).toBeCloseTo(5, 1)
  expect(struck.point.y).toBeCloseTo(radius, 1)
  expect(struck.normal.x).toBeCloseTo(1)
  expect(struck.otherCollider.handle).toBe(wall.handle)
})
test('two balls striking each other count once, and only registered bodies count at all', () => {
  const {world, contacts, sampler, step} = physics()
  const left = ball(world, [-1, 0.14, 0])
  const right = ball(world, [1, 0.14, 0])
  const stranger = ball(world, [0, 0.14, 2])
  sampler.register(left, 'left')
  const unregister = sampler.register(right, 'right')
  step(30)
  contacts.length = 0
  roll(left, 3)
  roll(right, -3)
  stranger.setTranslation({
    x: 0,
    y: 1,
    z: 2,
  }, true)
  step(30)
  expect(contacts).toHaveLength(1)
  const [clink] = contacts
  expect(new Set([clink.tag, clink.other])).toEqual(new Set(['left', 'right']))
  expect(new Set([clink.body.handle, clink.otherBody?.handle])).toEqual(new Set([left.handle, right.handle]))
  expect(clink.point.y).toBeCloseTo(radius, 2)
  // Both closed in at 3 m/s.
  expect(clink.speed).toBeCloseTo(6, 0)
  unregister()
  contacts.length = 0
  right.setTranslation({
    x: 0,
    y: 1,
    z: -2,
  }, true)
  step(90)
  expect(contacts.every(contact => contact.tag === 'left')).toBe(true)
})
test('a box dropped askew strikes with a corner first and lands flat at last, while the points it keeps touching stay quiet', () => {
  const {world, contacts, sampler, step} = physics()
  // Lying on its back, but tipped over two of its sides, so one corner hangs lowest
  const sideways = {
    x: 0,
    y: 0,
    z: Math.sin(0.15),
    w: Math.cos(0.15),
  }
  const angle = -Math.PI / 2 + 0.3
  const tipped = multiply(makeRotation(), sideways, {
    x: Math.sin(angle / 2),
    y: 0,
    z: 0,
    w: Math.cos(angle / 2),
  })
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.6, 0).setRotation(tipped).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.35, 0.25, 0.03).setMass(2).setFriction(0.75).setRestitution(0.32), body)
  sampler.register(body, 'box')
  /** how far each strike’s normal, in the box’s own frame, leans along its thin side: 1 lands flat on a face */
  const flatness: Array<number> = []
  for (let i = 0; i < 240; i++) {
    const count = contacts.length
    step(1)
    if (contacts.length === count) {
      continue
    }
    const {normal, rotation} = contacts.at(-1)!
    const local = rotate(makeVector(), normal, invert(makeRotation(), rotation))
    expect(Math.hypot(local.x, local.y, local.z)).toBeCloseTo(1)
    flatness.push(Math.abs(local.z))
  }
  expect(flatness[0]).toBeLessThan(0.97)
  expect(flatness.at(-1)).toBeGreaterThan(0.99)
  // It strikes a few times on its way down, not on every step it lies there.
  expect(flatness.length).toBeLessThan(8)
})
test('the threshold and the cooldown decide which strikes count', () => {
  const strict = physics({threshold: 3})
  strict.sampler.register(ball(strict.world, [0, 1.3, 0]), 'ball')
  strict.step(240)
  // Only the first strike, at 4.8 m/s, is fast enough.
  expect(strict.contacts).toHaveLength(1)
  const patient = physics({cooldown: 10})
  patient.sampler.register(ball(patient.world, [0, 1.3, 0]), 'ball')
  patient.step(240)
  expect(patient.contacts).toHaveLength(1)
})
test('the speed of a body right before the last steps outlasts its bounce', () => {
  const {world, contacts, sampler, step} = physics()
  const body = ball(world, [0, 1.3, 0])
  const stranger = ball(world, [2, 1.3, 0])
  sampler.register(body, 'ball')
  expect(sampler.recentSpeed(body)).toBe(0)
  expect(sampler.recentSpeed(stranger)).toBeUndefined()
  while (!contacts.length) {
    step(1)
  }
  // The solver has bounced it by now.
  const {x, y, z} = body.linvel()
  expect(Math.hypot(x, y, z)).toBeLessThan(contacts[0].speed * 0.5)
  expect(sampler.recentSpeed(body)).toBeCloseTo(contacts[0].speed, 0)
  step(240)
  expect(sampler.recentSpeed(body)).toBeCloseTo(0, 1)
})
test('bodies without a tag register just as well', () => {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0))
  let strikes = 0
  const sampler = new BodyContacts({
    onContact(contact) {
      strikes++
      expect(contact.tag).toBeUndefined()
      // The floor belongs to no body.
      expect(contact.otherBody).toBeUndefined()
    },
  })
  sampler.register(ball(world, [0, 1, 0]))
  for (let i = 0; i < 120; i++) {
    sampler.capture()
    world.step()
    sampler.collect(world)
  }
  expect(strikes).toBeGreaterThan(0)
})
test('a removed body is passed over', () => {
  const {world, contacts, sampler, step} = physics()
  const body = ball(world, [0, 0.3, 0])
  sampler.register(body, 'ball')
  step(2)
  world.removeRigidBody(body)
  step(60)
  expect(contacts).toEqual([])
})
