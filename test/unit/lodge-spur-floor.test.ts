import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {baseboardCapFront, defaultBaseboardHeight, wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionLink, lodgeSpur} from '../../src/lib/gallery/bastionNetwork.ts'
import RoutedPassage from '../../src/lib/gallery/passages/RoutedPassage.ts'
import RouteVaultGeometry, {pavingThickness} from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls from './fixtures/gallery.ts'
import {addOrb, bastionColliders, physicsWorld} from './helpers/bastionWorld.ts'

await RAPIER.init()
const [x, z] = lodgeSpur.route.start
const half = lodgeSpur.width / 2
const material = new MeshBasicMaterial
const link = new RouteVaultGeometry(bastionLink)
const spur = new RouteVaultGeometry(lodgeSpur)
const paving = [link, spur].map(parts => {
  parts.paving.boundsTree = new MeshBVH(parts.paving)
  const mesh = new Mesh(parts.paving, material)
  mesh.raycast = acceleratedRaycast
  return mesh
})
const down = new Raycaster(new Vector3, new Vector3(0, -1, 0))
down.firstHitOnly = true
const height = (mesh: Mesh, px: number, pz: number) => {
  down.ray.origin.set(px, 0, pz)
  return down.intersectObject(mesh)[0]?.point.y
}
afterAll(() => {
  link.dispose()
  spur.dispose()
  material.dispose()
})
test('the knight spur meets the golf passage at both jambs and every point between, with no ledge or slit', () => {
  expect(lodgeSpur.floorInlet).toBeDefined()
  // From jamb to jamb, not only in the middle
  for (let across = -half; across <= half; across += 0.013) {
    const px = x + across
    expect(lodgeSpur.floorAt(px, z)).toBeCloseTo(bastionLink.floorAt(px, z)!, 9)
    const linkY = height(paving[0], px, z + 0.000001)
    const spurY = height(paving[1], px, z - 0.000001)
    expect(linkY).toBeDefined()
    expect(spurY).toBeDefined()
    expect(spurY).toBeCloseTo(linkY, 5)
    expect(spurY).toBeCloseTo(lodgeSpur.floorAt(px, z - 0.000001)!, 6)
  }
  for (const side of [-1, 1]) {
    expect(lodgeSpur.floorAt(x + side * half, z)).toBeCloseTo(bastionLink.floorAt(x + side * half, z)!, 9)
  }
})
test('the doorway cuts below the entire sloping floor, with no stone sill left across its low side', () => {
  const wall = bastionLink.walls.find(candidate => candidate.holes?.some(hole => hole.name === 'lodge_spur'))!
  expect(wall.holes!.find(hole => hole.name === 'lodge_spur')!.bottom).toBeUndefined()
  const architecture = createArchitectureGeometry(wall)
  const meshes = [architecture.surface, ...architecture.trim].map(geometry => {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(...wall.center)
    mesh.rotation.y = wall.rotation
    mesh.updateMatrixWorld(true)
    return mesh
  })
  try {
    for (const across of [-1, 0, 1]) {
      const ray = new Raycaster(new Vector3(x + across, lodgeSpur.floorAt(x + across, z)! + 0.015, z + 0.3), new Vector3(0, 0, -1), 0, 0.6)
      expect(ray.intersectObjects(meshes)).toHaveLength(0)
    }
  } finally {
    architecture.dispose()
  }
})
test('both wall feet and their baseboards follow the corrected entrance, without moving the vault', () => {
  for (const wall of lodgeSpur.walls.slice(0, 2)) {
    for (const [u, rise] of wall.baseboardProfile!) {
      const [px, , pz] = wallPosition(wall, u, rise, 0)
      expect(wall.center[1] + rise).toBeCloseTo(lodgeSpur.floorAt(px, pz)!, 8)
      expect(wall.center[1]).toBeLessThanOrEqual(wall.center[1] + rise + 1e-9)
    }
  }
  const unchanged = new RoutedPassage('lodge-spur', 'bastion', lodgeSpur.route, lodgeSpur.width, {
    fixPavingEdges: false,
    openings: lodgeSpur.walls.flatMap(wall => (wall.holes ?? []).map(({u, ...hole}) => {
      const [px, , pz] = wallPosition(wall, u, 0, 0)
      const projection = lodgeSpur.route.project(px, pz)!
      const foot = lodgeSpur.route.at(projection.along).y
      return {
        ...hole,
        name: hole.name!,
        along: projection.along,
        side: Math.sign(projection.right) as -1 | 1,
        bottom: wall.center[1] + (hole.bottom ?? 0) - foot,
        height: wall.center[1] + hole.height - foot,
      }
    })),
  })
  const original = new RouteVaultGeometry(unchanged)
  try {
    expect(colliderGeometry(spur.shell)).toEqual(colliderGeometry(original.shell))
    expect(colliderGeometry(spur.ribs)).toEqual(colliderGeometry(original.ribs))
    for (let along = 2; along <= lodgeSpur.route.length; along += 0.031) {
      const station = lodgeSpur.route.at(along)
      for (const across of [-half, -half + wallFace, 0, half - wallFace, half]) {
        expect(lodgeSpur.floorY(station, across)).toBeCloseTo(station.y, 10)
      }
    }
    // No break in either the height or the finishing slope where the inlet meets the level floor.
    for (const across of [-half, 0, half]) {
      expect(lodgeSpur.floorAt(x + across, z - 2)).toBe(-5)
      expect(Math.abs(lodgeSpur.floorAt(x + across, z - 1.999)! + 5)).toBeLessThan(0.0001)
    }
  } finally {
    original.dispose()
  }
})
test('the visible baseboard caps follow the reshaped floor, not just their profile metadata', () => {
  for (const id of ['bastion-lodge-spur_wall_0', 'bastion-lodge-spur_wall_1']) {
    const wall = walls.find(candidate => candidate.id === id)!
    const architecture = createArchitectureGeometry(wall)
    const meshes = architecture.trim.map(part => new Mesh(part, material))
    try {
      for (let u = -wall.width / 2 + 0.01; u < wall.width / 2; u += 0.037) {
        const ray = new Raycaster(new Vector3(u, 2, baseboardCapFront - 0.01), new Vector3(0, -1, 0))
        const [px, , pz] = wallPosition(wall, u, 0, 0)
        const top = ray.intersectObjects(meshes)[0]
        expect(top).toBeDefined()
        expect(top.point.y + wall.center[1]).toBeCloseTo(lodgeSpur.floorAt(px, pz)! + (wall.baseboardHeight ?? defaultBaseboardHeight), 6)
      }
    } finally {
      architecture.dispose()
    }
  }
})
test('the entrance slab stays solid and equally thick across its tilt', () => {
  const bottom = new Mesh(spur.paving, material)
  const up = new Raycaster(new Vector3, new Vector3(0, 1, 0))
  for (let across = -half + 0.01; across < half; across += 0.173) {
    for (let along = 0.01; along < 2; along += 0.137) {
      up.ray.origin.set(x + across, -7, z - along)
      const hit = up.intersectObject(bottom)[0]
      expect(hit).toBeDefined()
      expect(hit.point.y).toBeCloseTo(lodgeSpur.floorAt(x + across, z - along)! - pavingThickness, 6)
    }
  }
})
const colliders = bastionColliders()
for (const returning of [false, true]) {
  for (const across of [-0.85, 0, 0.85]) {
    test(`the player crosses both sides of the seam without jumping or autostep, lane ${across}, returning ${returning}`, () => {
      const world = physicsWorld(colliders)
      const startZ = z + (returning ? -3 : 0.8)
      const endZ = z + (returning ? 0.8 : -3)
      const floor = (pz: number) => (pz < z ? lodgeSpur : bastionLink).floorAt(x + across, pz)!
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x + across, floor(startZ) + 0.003, startZ))
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
      const motor = new EgoMotor(RAPIER, world, body, collider, {stepHeight: 0})
      const facing = new Quaternion
      facing.setFromAxisAngle(new Vector3(0, 1, 0), returning ? Math.PI : 0)
      try {
        for (let frame = 0; frame < 30; frame++) {
          motor.step(world.timestep, {}, facing)
          world.step()
        }
        let previousY = body.translation().y
        let maxStep = 0
        for (let frame = 0; frame < 180; frame++) {
          if (Math.abs(body.translation().z - endZ) < 0.12) {
            break
          }
          motor.step(world.timestep, {forward: true}, facing)
          world.step()
          const position = body.translation()
          maxStep = Math.max(maxStep, Math.abs(position.y - previousY))
          previousY = position.y
          expect(position.y).toBeGreaterThan(floor(position.z) - 0.1)
          expect(position.y).toBeLessThan(floor(position.z) + 0.1)
        }
        expect(Math.abs(body.translation().z - endZ)).toBeLessThan(0.12)
        expect(maxStep).toBeLessThan(0.06)
        for (let frame = 0; frame < 20; frame++) {
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
for (const returning of [false, true]) {
  test(`an orb rolls across the inlet’s join with its level slab, returning ${returning}`, () => {
    const world = physicsWorld(colliders)
    const start = returning ? 2.8 : 1.2
    const finish = returning ? 1.2 : 2.8
    const body = addOrb(world, [x, lodgeSpur.floorAt(x, z - start)! + 0.142, z - start])
    body.setLinvel({
      x: 0,
      y: 0,
      z: returning ? 3 : -3,
    }, true)
    try {
      let reached = false
      for (let frame = 0; frame < 120; frame++) {
        world.step()
        const position = body.translation()
        const floor = lodgeSpur.floorAt(position.x, position.z)!
        expect(position.y - floor).toBeGreaterThan(0.125)
        expect(position.y - floor).toBeLessThan(0.18)
        if (returning ? position.z >= z - finish : position.z <= z - finish) {
          reached = true
          break
        }
      }
      expect(reached).toBe(true)
    } finally {
      world.free()
    }
  })
}
