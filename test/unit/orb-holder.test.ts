import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import {colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import OrbHolderGeometry, {orbSeat} from '../../src/lib/gallery/OrbHolderGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {orbRadius} from '../../src/orbs/index.ts'

await RAPIER.init()
/** Where an orb let down onto the holder from just over its seat, pushed by `velocity`, comes to rest after `seconds`, and how low it went on the way. */
function settle(geometry: OrbHolderGeometry, velocity: readonly [number, number, number], seconds = 6) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 120
  try {
    const holder = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry.collision)), holder)
    const orb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, orbSeat + 0.002, 0).setLinvel(...velocity))
    world.createCollider(RAPIER.ColliderDesc.ball(orbRadius), orb)
    let lowest = Infinity
    for (let step = 0; step < seconds * 120; step++) {
      world.step()
      lowest = Math.min(lowest, orb.translation().y)
    }
    const {x, y, z} = orb.translation()
    return {
      lowest,
      position: [x, y, z],
    }
  } finally {
    world.free()
  }
}
describe('the orb holder', () => {
  test('stands on the cap within the pedestal’s footprint, lower than the orb it holds', () => {
    const geometry = new OrbHolderGeometry
    try {
      geometry.metal.computeBoundingBox()
      const {min, max} = geometry.metal.boundingBox!
      expect(min.y).toBeCloseTo(0, 6)
      expect(Math.max(-min.x, max.x, -min.z, max.z)).toBeLessThan(0.58)
      // Its three feet spread wider than the orb, one of them to the front, along +z, which rises out of it by most of its height.
      expect(max.z).toBeGreaterThan(orbRadius)
      expect(-min.z).toBeLessThan(max.z)
      expect(max.x).toBeCloseTo(-min.x, 6)
      expect(max.y).toBeLessThan(orbSeat)
      expect(orbSeat - orbRadius).toBeGreaterThan(0.07)
      expect(triangleCount(geometry.metal)).toBeLessThan(4096)
    } finally {
      geometry.dispose()
    }
  })
  test('holds an orb let down onto its lip right where it was let down, and keeps it when it is nudged', () => {
    const geometry = new OrbHolderGeometry
    try {
      for (const velocity of [[0, 0, 0], [0.4, 0, 0.2], [-1.5, 0, 0]] as const) {
        const {lowest, position: [x, y, z]} = settle(geometry, velocity)
        expect(Math.hypot(x, z)).toBeLessThan(0.002)
        expect(y).toBeCloseTo(orbSeat, 2)
        expect(lowest).toBeGreaterThan(orbSeat - 0.002)
      }
    } finally {
      geometry.dispose()
    }
  })
})
