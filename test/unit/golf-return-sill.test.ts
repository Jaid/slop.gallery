import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {bastionGolfSill, golfSillFloor, golfSillGeometry} from '../../src/lib/gallery/BastionLanding.ts'
import {bastionLinkGate, climbMouthHollow} from '../../src/lib/gallery/bastionNetwork.ts'
import {climbMouth} from '../../src/lib/gallery/climb.ts'
import {slabHulls} from '../../src/lib/gallery/floorPolygons.ts'
import {addOrb, bastionColliders, physicsWorld} from './helpers/bastionWorld.ts'

await RAPIER.init()
const colliders = bastionColliders()
const sill = bastionGolfSill
const geometry = golfSillGeometry()
const material = new MeshBasicMaterial
const mesh = new Mesh(geometry, material)
afterAll(() => {
  geometry.dispose()
  material.dispose()
})
test('the visible return threshold and navigation agree, and replace rather than overlap the original slab', () => {
  const ray = new Raycaster(new Vector3, new Vector3(0, -1, 0))
  for (let x = sill.x + 0.001; x < sill.x + sill.depth; x += 0.013) {
    ray.ray.origin.set(x, 0, sill.z)
    expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(golfSillFloor(x, sill.z)!, 5)
    expect(climbMouthHollow.floorAt(x, sill.z)).toBe(golfSillFloor(x, sill.z))
  }
  const world = new RAPIER.World({
    x: 0,
    y: 0,
    z: 0,
  })
  try {
    for (const floor of climbMouth.floors.flatMap(polygon => climbMouthHollow.cut(polygon))) {
      for (const corners of slabHulls(floor, sill.y - 0.24, sill.y)) {
        world.createCollider(RAPIER.ColliderDesc.convexHull(corners)!)
      }
    }
    world.step()
    const beneath = new RAPIER.Ray({
      x: sill.x + sill.depth / 2,
      y: sill.y + 0.1,
      z: sill.z,
    }, {
      x: 0,
      y: -1,
      z: 0,
    })
    expect(world.castRay(beneath, 1, true)).toBeNull()
  } finally {
    world.free()
  }
})
for (const returning of [false, true]) {
  for (const lane of [-1.2, 0, 1.2]) {
    test(`the player steps across the return sill without jumping, lane ${lane}, returning ${returning}`, () => {
      const world = physicsWorld(colliders)
      const start = sill.x + (returning ? 1.8 : -1)
      const finish = sill.x + (returning ? -1 : 1.8)
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start, sill.y + 0.003, sill.z + lane))
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
      const motor = new EgoMotor(RAPIER, world, body, collider)
      const facing = new Quaternion
      facing.setFromAxisAngle(new Vector3(0, 1, 0), returning ? Math.PI / 2 : -Math.PI / 2)
      try {
        for (let frame = 0; frame < 30; frame++) {
          motor.step(world.timestep, {}, facing)
          world.step()
        }
        for (let frame = 0; frame < 240 && Math.abs(body.translation().x - finish) > 0.12; frame++) {
          motor.step(world.timestep, {forward: true}, facing)
          world.step()
          expect(body.translation().y).toBeGreaterThan(sill.y - 0.05)
        }
        expect(Math.abs(body.translation().x - finish)).toBeLessThan(0.12)
        for (let frame = 0; frame < 30; frame++) {
          motor.step(world.timestep, {}, facing)
          world.step()
        }
        expect(motor.grounded).toBe(true)
      } finally {
        motor.dispose()
        world.free()
      }
    })
  }
}
const gateX = bastionLinkGate.wall.center[0] + bastionLinkGate.hatch.u
const gateZ = bastionLinkGate.wall.center[2]
for (const speed of [1, 2, 4]) {
  for (const zOffset of [1, 2, 3]) {
    test(`an eastbound miss at ${speed} m/s returns to the mouse hole from ${zOffset} m in front of it`, () => {
      const world = physicsWorld(colliders)
      const x = gateX + 0.8
      const z = gateZ + zOffset
      const body = addOrb(world, [x, climbMouthHollow.floorAt(x, z)! + 0.142, z])
      body.setLinvel({
        x: speed,
        y: 0,
        z: 0,
      }, true)
      try {
        let crossed = false
        for (let frame = 0; frame < 60 * 120; frame++) {
          world.step()
          const position = body.translation()
          expect(position.x).toBeLessThan(sill.x + sill.depth)
          if (position.z < gateZ - 0.3) {
            crossed = true
            break
          }
        }
        expect(crossed, JSON.stringify(body.translation())).toBe(true)
      } finally {
        world.free()
      }
    })
  }
}
