import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'

import PropPlacement from '../../src/lib/physics/PropPlacement.ts'

await RAPIER.init()
let world: RAPIER.World
beforeEach(() => {
  world = new RAPIER.World({
    x: 0,
    y: 0,
    z: 0,
  })
})
afterEach(() => world.free())
/** a flat, three-part prop, so sweeps have to handle offset compound parts */
function slab() {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 1.42, 1.6))
  for (const [width, height, depth, y] of [[0.64, 0.095, 0.86, 0], [0.69, 0.025, 0.91, -0.06], [0.69, 0.025, 0.91, 0.06]]) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setTranslation(0, y, 0).setEnabled(false), body)
  }
  return new PropPlacement(world, body)
}
function pedestal() {
  return world.createCollider(RAPIER.ColliderDesc.cuboid(0.58, 0.675, 0.58).setTranslation(0, 0.675, 1.6))
}
describe('where a released prop goes', () => {
  test('pulls the whole slab toward the hand instead of through its pedestal', () => {
    const placement = slab()
    pedestal()
    world.step()
    const desired: [number, number, number] = [0, 1.2, 1.45]
    expect(placement.hasRoom(desired)).toBe(false)
    const position = placement.sweep([0, 1.4, 0], desired)
    expect(position[2]).toBeGreaterThan(0.4)
    expect(position[2] + 0.455).toBeLessThan(1.02)
    expect(placement.hasRoom(position)).toBe(true)
  })
  test('uses rotated compound geometry, not a hardcoded bounding radius', () => {
    const placement = slab()
    placement.body.setRotation({
      x: 0,
      y: Math.SQRT1_2,
      z: 0,
      w: Math.SQRT1_2,
    }, false)
    pedestal()
    world.step()
    const position = placement.sweep([0, 1.4, 0], [0, 1.2, 1.45])
    expect(position[2]).toBeGreaterThan(0.6)
    expect(position[2] + 0.345).toBeLessThan(1.02)
    expect(placement.hasRoom(position)).toBe(true)
  })
  test('does not tunnel through a thin obstacle to a clear endpoint', () => {
    const placement = slab()
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.02).setTranslation(0, 1, 0.9))
    world.step()
    expect(placement.hasRoom([0, 1.4, 1.6])).toBe(true)
    const position = placement.sweep([0, 1.4, 0], [0, 1.4, 1.6])
    expect(position[2]).toBeLessThan(0.43)
    expect(placement.hasRoom(position)).toBe(true)
  })
  test('sweeps out of the player’s capsule and may end inside it, which it passes through for a moment', () => {
    const placement = slab()
    const player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased())
    player.userData = {isPlayer: true}
    world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), player)
    world.step()
    expect(placement.sweep([0, 1.4, 0], [0, 1.4, 1.45])).toEqual([0, 1.4, 1.45])
    expect(placement.hasRoom([0, 1.4, 0])).toBe(false)
    expect(placement.hasRoom([0, 1.4, 0], false)).toBe(true)
    // Held right where the player stands, as when looking straight down, it is let go of there instead of anywhere else.
    const below = placement.letGo([0, 1.4, 0], [0, 1.2, 0.1])
    for (const [axis, value] of [0, 1.2, 0.1].entries()) {
      expect(below[axis]).toBeCloseTo(value, 9)
    }
  })
  test('does not treat an unrelated kinematic body like the player', () => {
    const placement = slab()
    const door = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.8, 1.3))
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.3, 1.8, 0.14), door)
    world.step()
    expect(placement.sweep([0, 1.4, 0], [0, 1.4, 1.45])[2]).toBeLessThan(0.71)
  })
  test('ignores disabled colliders and sensors but respects dynamic props', () => {
    const placement = slab()
    pedestal().setSensor(true)
    pedestal().setEnabled(false)
    world.step()
    expect(placement.sweep([0, 1.4, 0], [0, 1.2, 1.45])[2]).toBeCloseTo(1.45)
    const prop = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.2, 1.45))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3), prop)
    world.step()
    expect(placement.sweep([0, 1.4, 0], [0, 1.2, 1.45])[2]).toBeLessThan(0.7)
  })
  test('keeps the slab above the floor when looking down', () => {
    const placement = slab()
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.15, 10).setTranslation(0, -0.15, 0))
    world.step()
    const position = placement.letGo([0, 1.4, 0], [0, -0.1, 0])
    expect(position[1]).toBeGreaterThan(0.09)
    expect(placement.hasRoom(position)).toBe(true)
  })
  test('leaves an unobstructed pose unchanged, including a zero-length move', () => {
    const placement = slab()
    world.step()
    expect(placement.letGo([0, 1.4, 0], [0, 1.4, 1.45])).toEqual([0, 1.4, 1.45])
    expect(placement.letGo([0, 1.4, 0], [0, 1.4, 0])).toEqual([0, 1.4, 0])
  })
  test('pushes a prop that already reaches into a wall where it starts out of it, on the near side', () => {
    const placement = slab()
    // A wall whose face is 0.3 m in front of the hand: the slab reaches 0.455 m ahead of its middle, so it is in the wall from the start, and the sweep, which begins inside it, cannot stop short of it.
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1.4, 0.4))
    world.step()
    expect(placement.hasRoom([0, 1.4, 0], false)).toBe(false)
    const position = placement.letGo([0, 1.4, 0], [0, 1.4, 1.45])
    expect(placement.hasRoom(position, false)).toBe(true)
    expect(position[2] + 0.455).toBeLessThanOrEqual(0.3 + 0.001)
    expect(position[2] + 0.455).toBeGreaterThan(0.2)
    expect(Math.abs(position[0])).toBeLessThan(1e-6)
  })
  test('squeezes a prop let go of in a corner out of both walls', () => {
    const placement = slab()
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(0, 1.4, 0.4))
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 2, 2).setTranslation(0.3, 1.4, 0))
    world.step()
    const position = placement.letGo([0, 1.4, 0], [0, 1.4, 1.45])
    expect(placement.hasRoom(position, false)).toBe(true)
    expect(position[0] + 0.32).toBeLessThanOrEqual(0.2 + 0.001)
    expect(position[2] + 0.455).toBeLessThanOrEqual(0.3 + 0.001)
  })
  test('never pushes a prop out to the far side of what stands between it and the hand', () => {
    const placement = slab()
    // A thin pane 0.2 m in front of the hand, whose far side is nearer to where the slab reaches into it.
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 0.01).setTranslation(0, 1.4, 0.2))
    world.step()
    const position = placement.letGo([0, 1.4, 0], [0, 1.4, 1.45])
    expect(position[2]).toBeLessThan(0.2)
    expect(placement.hasRoom(position, false)).toBe(true)
  })
  test('without room anywhere near the hand, lets go of the prop where it is in the least, never back where it was', () => {
    const placement = slab()
    world.createCollider(RAPIER.ColliderDesc.cuboid(2, 2, 2))
    world.step()
    const home = placement.body.translation()
    const position = placement.letGo([0, 1.4, 0], [0, 1.2, 1.45])
    expect(position).not.toEqual([home.x, home.y, home.z])
    expect(Math.hypot(position[0], position[1] - 1.4, position[2])).toBeLessThan(1.5)
    expect(placement.depth(position)).toBeGreaterThan(0)
  })
})
