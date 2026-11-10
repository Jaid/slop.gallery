import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor, {defaultEgoOptions} from 'ego-player/motor'
import {DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {bastionCrater, bastionCurve, bastionLinkStart} from '../../src/lib/gallery/bastion.ts'
import {rubbleShelf} from '../../src/lib/gallery/BastionCraterGeometry.ts'
import RouteVaultGeometry, {pavingThickness} from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import {orbRadius} from '../../src/orbs/index.ts'
import {bastionCraterGeometry} from './helpers/bastionCrater.ts'
import {bastionColliders, physicsWorld} from './helpers/bastionWorld.ts'

await RAPIER.init()
const curve = new RouteVaultGeometry(bastionCurve)
afterAll(() => {
  curve.dispose()
})
const [centerX, floorY, centerZ] = bastionCrater.center
/** how far the crater’s broken edge reaches from its middle, at most */
const reach = Math.max(...bastionCrater.outline.map(([x, z]) => Math.hypot(x - centerX, z - centerZ)))
const colliders = bastionColliders()
/** The Bastion’s passages and walls as the game builds their colliders, with the crater. */
const bastionWorld = () => physicsWorld(colliders)
test('the crater breaks through the landing’s paving on the link’s axis, its edge 10 cm short of the doorway’s line', () => {
  expect(centerX).toBe(bastionLinkStart.point[0])
  expect(Math.max(...bastionCrater.outline.map(([, z]) => z))).toBeLessThan(bastionLinkStart.point[1] - 0.1 + 1e-9)
  expect(Math.max(...bastionCrater.outline.map(([, z]) => z))).toBeGreaterThan(bastionLinkStart.point[1] - 0.2)
  expect(floorY).toBe(bastionLinkStart.y)
  expect(bastionCurve.pits).toEqual([bastionCrater.outline])
  const material = new MeshBasicMaterial({side: DoubleSide})
  const paving = new Mesh(curve.paving, material)
  const rubble = new Mesh(bastionCraterGeometry.rubble, material)
  rubble.position.set(...bastionCrater.center)
  rubble.updateMatrixWorld()
  try {
    const down = (x: number, z: number) => new Raycaster(new Vector3(x, floorY + 1, z), new Vector3(0, -1, 0))
    // Nothing but rubble inside its edge, the depth of its middle under the floor there
    const middle = down(centerX, centerZ)
    expect(middle.intersectObject(paving)).toHaveLength(0)
    expect(middle.intersectObject(rubble)[0].point.y).toBeCloseTo(floorY - bastionCrater.depth, 2)
    for (const [x, z] of bastionCrater.outline) {
      const out = Math.hypot(x - centerX, z - centerZ)
      const [dx, dz] = [(x - centerX) / out, (z - centerZ) / out]
      expect(down(centerX + dx * (out - 0.05), centerZ + dz * (out - 0.05)).intersectObject(paving)).toHaveLength(0)
      // Just outside it, the paving’s floor and its slab’s underside, as everywhere else
      const outside = down(centerX + dx * (out + 0.05), centerZ + dz * (out + 0.05)).intersectObject(paving).map(hit => hit.point.y)
      expect(outside[0]).toBeCloseTo(floorY, 6)
      expect(outside.at(-1)).toBeCloseTo(floorY - pavingThickness, 6)
    }
  } finally {
    material.dispose()
  }
  expect(reach).toBeLessThan(bastionCrater.radius * 1.05 + 1e-9)
  expect(Math.min(...bastionCrater.outline.map(([x, z]) => Math.hypot(x - centerX, z - centerZ)))).toBeGreaterThan(bastionCrater.radius * 0.95)
})
test('the rubble meets the broken edge at the paving’s underside, and the broken ends of the tipped flags hang too high over it for an orb that fell in to roll back out, but low enough for a player to step out', () => {
  const position = bastionCraterGeometry.rubble.getAttribute('position')
  const corners = bastionCrater.outline.map(([x, z]) => [x - centerX, z - centerZ])
  const rim = Array.from({length: position.count}, (_, i) => i).filter(i => corners.some(([x, z]) => Math.hypot(position.getX(i) - x, position.getZ(i) - z) < 1e-6))
  expect(rim).toHaveLength(corners.length)
  for (const i of rim) {
    expect(position.getY(i)).toBeCloseTo(-pavingThickness, 6)
  }
  for (const part of [bastionCraterGeometry.rubble, bastionCraterGeometry.shards]) {
    part.computeBoundingBox()
    expect(part.boundingBox!.max.y).toBeLessThan(-orbRadius - 0.05)
  }
  expect(bastionCraterGeometry.drops.length).toBeGreaterThan(corners.length / 3)
  for (const drop of bastionCraterGeometry.drops) {
    expect(rubbleShelf - drop).toBeGreaterThan(orbRadius * 1.25)
    expect(rubbleShelf - drop).toBeLessThan(defaultEgoOptions.stepHeight - 0.03)
  }
  // Tipped into the crater, the flags reach no higher than a little over the floor where they bend up with its edge.
  bastionCraterGeometry.flags.computeBoundingBox()
  expect(bastionCraterGeometry.flags.boundingBox!.max.y).toBeLessThan(0.03)
})
// North, west and east, over the level landing
for (const heading of [0, Math.PI / 2, -Math.PI / 2]) {
  test(`a player who fell into the crater walks back out, heading ${heading.toFixed(2)}`, () => {
    const world = bastionWorld()
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(centerX, floorY + 0.04, centerZ))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
    const motor = new EgoMotor(RAPIER, world, body, collider)
    const facing = new Quaternion
    facing.setFromAxisAngle(new Vector3(0, 1, 0), heading)
    try {
      for (let frame = 0; frame < 60; frame++) {
        motor.step(world.timestep, {}, facing)
        world.step()
      }
      expect(body.translation().y).toBeLessThan(floorY - 0.1)
      for (let frame = 0; frame < 60; frame++) {
        motor.step(world.timestep, {forward: true}, facing)
        world.step()
      }
      for (let frame = 0; frame < 30; frame++) {
        motor.step(world.timestep, {}, facing)
        world.step()
      }
      const {x, y, z} = body.translation()
      expect(Math.hypot(x - centerX, z - centerZ)).toBeGreaterThan(reach + 0.3)
      // West, the curve’s climb toward the Lodge begins.
      expect(y).toBeCloseTo(bastionCurve.floorAt(x, z)! + 0.02, 2)
      expect(motor.grounded).toBe(true)
    } finally {
      motor.dispose()
      world.free()
    }
  })
}
