import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import {resistRolling} from '../../src/lib/physics/rollingResistance.ts'
import {orbMass, orbRadius} from '../../src/orbs/index.ts'

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
const extent = 200
/** the floors a ball rolls on: a box, and a mesh like the rooms’ floors, over which a ball hovers a hair without a single solver contact */
const floors = {
  box: () => RAPIER.ColliderDesc.cuboid(extent, 0.1, extent).setTranslation(0, -0.1, 0),
  mesh: () => RAPIER.ColliderDesc.trimesh(new Float32Array([-extent, 0, -extent, extent, 0, -extent, extent, 0, extent, -extent, 0, extent]), new Uint32Array([0, 2, 1, 0, 3, 2])),
}
type Floor = keyof typeof floors
const layFloor = (floor: Floor) => world.createCollider(floors[floor]().setFriction(0.8))
/** an orb’s ball at `height`, leaving with `velocity` and `spin` */
const ball = (velocity: Vec3, spin: Vec3, height = 1.2) => {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, height, 0).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.ball(orbRadius).setMass(orbMass).setFriction(0.8).setRestitution(0.32), body)
  body.setLinvel({
    x: velocity[0],
    y: velocity[1],
    z: velocity[2],
  }, true)
  body.setAngvel({
    x: spin[0],
    y: spin[1],
    z: spin[2],
  }, true)
  return body
}
/** Steps the world with the resistance for up to `seconds`, returning how long it took the ball to fall asleep, or infinity. */
const settle = (body: RAPIER.RigidBody, seconds: number, resist = true) => {
  for (let step = 1; step <= seconds * 60; step++) {
    world.step()
    if (resist) {
      resistRolling(world, body, world.timestep)
    }
    if (body.isSleeping()) {
      return step / 60
    }
  }
  return Number.POSITIVE_INFINITY
}
const length = ({x, y, z}: RAPIER.Vector) => Math.hypot(x, y, z)
describe.each(Object.keys(floors) as Array<Floor>)('on a %s floor', floor => {
  beforeEach(() => layFloor(floor))
  test('a ball spun like a top on the floor spins out within seconds, where Rapier alone spins it forever', () => {
    const spun = ball([0, 0, 0], [0, 7 * Math.PI, 0], orbRadius)
    expect(settle(spun, 6)).toBeLessThan(5)
    expect(spun.translation().x).toBeCloseTo(0, 2)
    expect(spun.translation().z).toBeCloseTo(0, 2)
    const unresisted = ball([0, 0, 0], [0, 7 * Math.PI, 0], orbRadius)
    expect(settle(unresisted, 6, false)).toBe(Number.POSITIVE_INFINITY)
    expect(length(unresisted.angvel())).toBeGreaterThan(20)
  })
  test('a rolling ball slows to rest, a knocked one within two meters, a thrown one within a room or two', () => {
    const knocked = ball([0, 0, -2], [0, 0, 0], orbRadius)
    expect(settle(knocked, 10)).toBeLessThan(4)
    expect(-knocked.translation().z).toBeLessThan(2.5)
    expect(-knocked.translation().z).toBeGreaterThan(1)
    const thrown = ball([0, 2, -10], [-6 * Math.PI, 0, 0])
    expect(settle(thrown, 20)).toBeLessThan(12)
    expect(-thrown.translation().z).toBeLessThan(40)
  })
})
test('in flight, it leaves the spin alone', () => {
  layFloor('box')
  const flying = ball([0, 2, -10], [0, 7 * Math.PI, 0], 20)
  for (let step = 0; step < 30; step++) {
    world.step()
    resistRolling(world, flying, world.timestep)
  }
  expect(flying.angvel().y).toBeCloseTo(7 * Math.PI, 3)
})
