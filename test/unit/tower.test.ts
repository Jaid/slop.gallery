import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {bastionMouth} from '../../src/lib/gallery/bastion.ts'
import {climbMouth} from '../../src/lib/gallery/climb.ts'
import {slabHulls} from '../../src/lib/gallery/floorPolygons.ts'
import lowerGallery, {oculusRamps} from '../../src/lib/gallery/lowerGallery.ts'
import OculusGroundGeometry from '../../src/lib/gallery/OculusGroundGeometry.ts'
import tower, {towerRamp as ramp, towerArch, towerBridge, towerBridgeGradient, towerBridgeLift, towerBridges, towerDeck, towerFloorHeight, towerPlatformOutline, towerRampGradient, towerRampHalfWidth, towerRampHeight} from '../../src/lib/gallery/oculusTower.ts'
import walls, {floorHeight} from './fixtures/gallery.ts'
import {addOculusRailings} from './helpers/oculusRailings.ts'

await RAPIER.init()
const geometry = new OculusGroundGeometry
const collision = colliderGeometry(geometry)
// The side walls the bridges lead to, with the doorways into the Bastion’s mouth at the east one’s end and the western climb’s at the west one’s
const bridgeWalls = walls.filter(wall => ['oculus-east', 'oculus-west'].includes(wall.id) || wall.id.startsWith('bastion-mouth_') || wall.id.startsWith('bastion-climb_mouth_')).map(wall => ({
  wall,
  geometry: createArchitectureGeometry(wall),
}))
afterAll(() => {
  geometry.dispose()
  for (const part of bridgeWalls) {
    part.geometry.dispose()
  }
})
function createWorld() {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.createCollider(RAPIER.ColliderDesc.trimesh(...collision))
  world.createCollider(RAPIER.ColliderDesc.cuboid(lowerGallery.oculus.size[0] / 2, 0.12, lowerGallery.oculus.size[1] / 2).setTranslation(lowerGallery.oculus.center[0], tower.floorY - 0.12, lowerGallery.oculus.center[1]))
  addOculusRailings(world)
  return world
}
describe('cylindrical Oculus platform', () => {
  test('both base corners are rounded with matching visible, collision and navigation surfaces', () => {
    const radius = ramp.baseCornerRadius
    expect(towerRampHalfWidth(ramp.startZ)).toBe(ramp.width / 2 + radius)
    expect(towerRampHalfWidth(ramp.startZ + radius)).toBeCloseTo(ramp.width / 2)
    expect(towerRampHalfWidth(ramp.endZ)).toBeCloseTo(ramp.width / 2)
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    const world = createWorld()
    try {
      world.step()
      for (const side of [-1, 1]) {
        for (const fraction of [0.13, 0.37, 0.61, 0.89]) {
          const theta = fraction * Math.PI / 2
          const z = ramp.startZ + radius * (1 - Math.cos(theta))
          const edge = ramp.width / 2 + radius * (1 - Math.sin(theta))
          expect(towerRampHalfWidth(z)).toBeCloseTo(edge, 6)
          for (const inset of [-0.02, 0.02]) {
            const x = tower.x + side * (edge - inset)
            const ray = new Raycaster(new Vector3(x, -2, z), new Vector3(0, -1, 0), 0, 4)
            const hit = ray.intersectObject(mesh)[0]
            const physical = world.castRay(new RAPIER.Ray(ray.ray.origin, ray.ray.direction), 4, true)
            expect(!!hit).toBe(inset > 0)
            expect(physical !== null).toBe(inset > 0)
            const top = towerFloorHeight(x, z)
            if (inset > 0) {
              expect(top).toBeDefined()
              expect(hit.point.y).toBeCloseTo(top!, 4)
              expect(-2 - physical!.timeOfImpact).toBeCloseTo(top!, 4)
            } else {
              expect(top).toBeUndefined()
            }
          }
        }
      }
    } finally {
      world.free()
      material.dispose()
    }
  })
  test('the ramp eases to horizontal at both ends without changing either elevation', () => {
    expect(towerRampHeight(0)).toBe(ramp.startY)
    expect(towerRampHeight(1)).toBe(ramp.endY)
    expect(towerRampGradient(0)).toBe(0)
    expect(towerRampGradient(1)).toBe(0)
    for (let i = 1; i <= ramp.segments; i++) {
      expect(towerRampHeight(i / ramp.segments)).toBeGreaterThan(towerRampHeight((i - 1) / ramp.segments))
      expect(towerRampGradient(i / ramp.segments)).toBeLessThan(Math.tan(35 * Math.PI / 180))
    }
    const lastRise = towerRampHeight(1) - towerRampHeight(1 - 1 / ramp.segments)
    expect(lastRise).toBeLessThan(0.002)
  })
  test('rounded shoulders blend the ramp’s end and both bridges into the circular platform symmetrically', () => {
    expect(towerPlatformOutline.length).toBeGreaterThan(150)
    const neckZ = ramp.endZ - tower.z
    // The outline starts across the ramp’s end, from its west corner.
    expect(towerPlatformOutline[0][0]).toBeCloseTo(-ramp.width / 2, 10)
    expect(towerPlatformOutline[0][1]).toBeCloseTo(neckZ, 10)
    expect(towerPlatformOutline[4][0]).toBeCloseTo(ramp.width / 2, 10)
    expect(towerPlatformOutline[4][1]).toBeCloseTo(neckZ, 10)
    for (const x of [-0.95, 0.95]) {
      expect(towerFloorHeight(x, tower.z - 1.2)).toBe(ramp.endY)
      expect(towerFloorHeight(x, ramp.endZ + 0.02)).toBeUndefined()
    }
    for (const {point} of towerDeck) {
      const mirrored = towerDeck.find(({point: [x, z]}) => Math.abs(x + point[0]) < 1e-9 && Math.abs(z - point[1]) < 1e-9)
      expect(mirrored).toBeDefined()
    }
    // Shoulders never cut into the round wall, and no part of the outline crosses another.
    for (const {point} of towerDeck) {
      expect(Math.hypot(...point)).toBeGreaterThan(tower.radius - 0.005)
    }
  })
  test('both bridges climb from the deck out to their walls, easing in and out, where they widen into the doorways they lead to', () => {
    for (const {angle, wallDistance} of towerBridges) {
      const direction = Math.cos(angle)
      let previous = ramp.endY
      for (const along of [tower.radius + 0.3, 4, 6.5, wallDistance - towerBridge.flareRadius - 0.2]) {
        const x = tower.x + direction * along
        for (const across of [-1, 1]) {
          expect(towerFloorHeight(x, tower.z + across * (towerBridge.width / 2 - 0.02))).toBe(ramp.endY + towerBridgeLift(along, wallDistance))
          expect(towerFloorHeight(x, tower.z + across * (towerBridge.width / 2 + 0.02))).toBeUndefined()
        }
        expect(towerFloorHeight(x, tower.z)!).toBeGreaterThanOrEqual(previous)
        previous = towerFloorHeight(x, tower.z)!
      }
      // Level where it leaves the deck and where it flares out toward its wall, and nowhere steeper than 10°
      expect(towerBridgeLift(tower.radius + 0.1, wallDistance)).toBe(0)
      expect(towerBridgeGradient(tower.radius + 0.1, wallDistance)).toBe(0)
      expect(towerBridgeGradient(wallDistance - 0.105 - towerBridge.flareRadius, wallDistance)).toBe(0)
      for (let along = tower.radius; along < wallDistance; along += 0.1) {
        expect(towerBridgeGradient(along, wallDistance)).toBeLessThan(Math.tan(10 * Math.PI / 180))
      }
      // At the wall’s face, the deck is as wide as the doorway, at the bridge’s full rise.
      const face = tower.x + direction * (wallDistance - 0.105)
      for (const across of [-1, 1]) {
        expect(towerFloorHeight(face, tower.z + across * (towerBridge.mouthWidth / 2 - 0.02))).toBeCloseTo(ramp.endY + towerBridge.rise, 9)
        expect(towerFloorHeight(face, tower.z + across * (towerBridge.mouthWidth / 2 + 0.02))).toBeUndefined()
      }
    }
  })
  test('the bridges leave more than 2.1 m of headroom over the side ramps and landings under them', () => {
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    try {
      for (const {angle, wallDistance} of towerBridges) {
        for (let along = tower.radius + 0.5; along < wallDistance - 0.2; along += 0.25) {
          for (let across = -towerBridge.mouthWidth / 2; across <= towerBridge.mouthWidth / 2; across += 0.25) {
            const x = tower.x + Math.cos(angle) * along
            const z = tower.z + across
            const down = new Raycaster(new Vector3(x, -1, z), new Vector3(0, -1, 0))
            const hits = down.intersectObject(mesh)
            if (hits.length < 3 || Math.abs(hits[0].point.y - towerFloorHeight(x, z)!) > 1e-4) {
              continue
            }
            // From the bridge’s underside down to what stands below it
            expect(hits[1].point.y - hits[2].point.y).toBeGreaterThan(2.1)
          }
        }
      }
    } finally {
      material.dispose()
    }
  })
  test('the merged lower slopes meet the high base without gaps or raised overlays', () => {
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    try {
      for (const slope of oculusRamps) {
        for (const z of [slope.startZ - 0.01, -24, -29.99, -30.01]) {
          // From under the bridges, which cross the side ramps at the tower
          const slopeRay = new Raycaster(new Vector3(slope.x, ramp.endY - towerBridge.thickness - 0.1, z), new Vector3(0, -1, 0))
          const hits = slopeRay.intersectObject(mesh)
          expect(hits).toHaveLength(1)
          const expected = z < slope.startZ - slope.run ? slope.floorY + slope.rise : slope.floorY + (slope.startZ - z) / slope.run * slope.rise
          expect(hits[0].point.y).toBeCloseTo(expected, 5)
        }
      }
    } finally {
      material.dispose()
    }
  })
  test('the merged landing and tower have one flush surface rather than stacked plates', () => {
    expect(ramp.endY).toBe(tower.floorY + tower.height)
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    try {
      for (const z of [-25.55, -25.3, -25.01, -24.8, -24.13]) {
        const landingRay = new Raycaster(new Vector3(0.37, -2, z), new Vector3(0, -1, 0))
        const hits = landingRay.intersectObject(mesh)
        expect(hits).toHaveLength(1)
        expect(hits[0].point.y).toBeCloseTo(ramp.endY, 5)
      }
    } finally {
      material.dispose()
    }
  })
  test('the support is solid down to the ground except for its real arched passage', () => {
    const world = createWorld()
    try {
      world.step()
      for (const offset of [-0.6, 0, 0.6]) {
        const origin = new Vector3(-2, tower.floorY + 1.7, towerArch.z + offset)
        expect(world.castRay(new RAPIER.Ray(origin, new Vector3(1, 0, 0)), 4, true)).toBeNull()
      }
      // The lower jamb is the base’s own front face, covered by the flush jamb test.
      for (const [y, z] of [[tower.floorY + towerArch.height + 0.1, towerArch.z], [tower.floorY + 1, towerArch.z + towerArch.width / 2 + 0.1]]) {
        expect(world.castRay(new RAPIER.Ray(new Vector3(-2, y, z), new Vector3(1, 0, 0)), 4, true)).not.toBeNull()
      }
    } finally {
      world.free()
    }
  })
  test('the underpass spans from the base’s flat front face to the circular tower’s rear edge', () => {
    expect(towerArch.z - towerArch.width / 2).toBe(ramp.startZ)
    expect(towerArch.z + towerArch.width / 2).toBeCloseTo(tower.z - tower.radius)
    expect(towerArch.width).toBeCloseTo(4.8)
  })
  test('the lower jamb is flush with the base’s front face, with no leftover sliver of the rounded fillets', () => {
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    const world = createWorld()
    try {
      world.step()
      // Looking south along the opening’s sides, at the height of a person, both meet the flat face itself.
      for (const x of [-ramp.width / 2 - ramp.baseCornerRadius + 0.05, -0.85, 0, 0.85, ramp.width / 2 + ramp.baseCornerRadius - 0.05]) {
        for (const y of [0.3, 1, 1.8]) {
          const ray = new Raycaster(new Vector3(tower.x + x, tower.floorY + y, towerArch.z), new Vector3(0, 0, -1), 0, 4)
          const hit = ray.intersectObject(mesh)[0]
          expect(hit.point.z).toBeCloseTo(ramp.startZ, 5)
          expect(hit.face!.normal.z).toBeCloseTo(1, 5)
          expect(world.castRay(new RAPIER.Ray(ray.ray.origin, ray.ray.direction), 4, true)!.timeOfImpact).toBeCloseTo(towerArch.z - ramp.startZ, 4)
        }
      }
    } finally {
      world.free()
      material.dispose()
    }
  })
  test('the cut stays lean', () => {
    // The smooth junctions of the round tower with the ramp and the bridges account for most of these.
    expect((geometry.index?.count ?? geometry.getAttribute('position').count) / 3).toBeLessThan(4500)
  })
  test('the underpass has a sloping roof with tangent rounded corners, the tall one curving into the round tower', () => {
    const half = towerArch.width / 2
    const slope = (towerArch.height - towerArch.lowHeight) / towerArch.width
    const radius = towerArch.cornerRadius
    const cx = half - radius
    const cy = towerArch.lowHeight + slope * radius - radius * Math.hypot(1, slope)
    const tangentAngle = Math.atan2(1, slope)
    const highRadius = towerArch.highCornerRadius
    // Above the passage’s center line, the fillet meets the tower’s wall at its northernmost point.
    const highCz = tower.z - tower.radius + 0.002 - highRadius
    const highCu = towerArch.z - highCz
    const highCy = towerArch.height - slope * (towerArch.z + half - highCz) - highRadius * Math.hypot(1, slope)
    const highEnd = Math.PI - Math.atan(1 / slope)
    // Each sample keeps the arc it lies on (center u, center height, radius), if any.
    const points: Array<[number, number, [number, number, number]?]> = [
      ...[0, -1, -1.5].map((u): [number, number] => [u, towerArch.height - slope * (u + half)]),
      ...[0.2, 0.45, 0.7, 0.95].map((fraction): [number, number, [number, number, number]] => {
        const angle = highEnd * fraction
        return [towerArch.z - (highCz + highRadius * Math.cos(angle)), highCy + highRadius * Math.sin(angle), [highCu, highCy, highRadius]]
      }),
      ...[0.15, 0.4, 0.7, 0.95].map((fraction): [number, number, [number, number, number]] => {
        const angle = tangentAngle * fraction
        return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), [cx, cy, radius]]
      }),
    ]
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    const world = createWorld()
    try {
      world.step()
      expect(towerArch.height - towerArch.lowHeight).toBeGreaterThan(0.7)
      for (const [u, height, arc] of points) {
        const z = towerArch.z - u
        const origin = new Vector3(tower.x, tower.floorY + 0.5, z)
        const direction = new Vector3(0, 1, 0)
        const archRay = new Raycaster(origin, direction)
        const visible = archRay.intersectObject(mesh)[0]
        const physical = world.castRay(new RAPIER.Ray(origin, direction), towerArch.height + 1, true)!
        if (arc) {
          // The rounded corners are a few chords each; they stay within 2 mm of the true arcs.
          const [centerU, centerHeight, arcRadius] = arc
          expect(Math.abs(Math.hypot(towerArch.z - visible.point.z - centerU, visible.point.y - tower.floorY - centerHeight) - arcRadius)).toBeLessThan(0.002)
        } else {
          expect(visible.point.y).toBeCloseTo(tower.floorY + height, 4)
        }
        expect(origin.y + physical.timeOfImpact).toBeCloseTo(visible.point.y, 4)
        // The original walkable ramp stays intact, with substantial stone above the tunnel.
        expect(towerRampHeight((z - ramp.startZ) / (ramp.endZ - ramp.startZ)) - visible.point.y).toBeGreaterThan(0.5)
        for (const side of [-1, 1]) {
          for (const delta of [-0.025, 0.025]) {
            const ray = new Raycaster(new Vector3(tower.x + side * 2, tower.floorY + height + delta, z), new Vector3(-side, 0, 0), 0, 4)
            expect(ray.intersectObject(mesh).length > 0).toBe(delta > 0)
            expect(world.castRay(new RAPIER.Ray(ray.ray.origin, ray.ray.direction), 4, true) !== null).toBe(delta > 0)
          }
        }
      }
      // The round tower closes the passage; the lower jamb is the base’s front face and has its own test.
      for (const inset of [-0.02, 0.02]) {
        const z = towerArch.z + half - inset
        const ray = new Raycaster(new Vector3(tower.x - 2, tower.floorY + 1, z), new Vector3(1, 0, 0), 0, 4)
        expect(ray.intersectObject(mesh).length > 0).toBe(inset < 0)
        expect(world.castRay(new RAPIER.Ray(ray.ray.origin, ray.ray.direction), 4, true) !== null).toBe(inset < 0)
      }
    } finally {
      world.free()
      material.dispose()
    }
  })
  for (const fps of [30, 60, 120]) {
    for (const offset of [-towerArch.width / 2 + 0.4, -0.4, 0, 0.4, towerArch.width / 2 - 0.4]) {
      for (const returning of [false, true]) {
        test(`walks through the arch at ${fps} Hz, offset ${offset.toFixed(2)}, returning ${returning}`, () => {
          const world = createWorld()
          world.timestep = 1 / fps
          const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(returning ? 2 : -2, tower.floorY + 0.04, towerArch.z + offset))
          const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
          const motor = new EgoMotor(RAPIER, world, body, collider)
          const facing = new Quaternion
          facing.setFromAxisAngle(new Vector3(0, 1, 0), returning ? Math.PI / 2 : -Math.PI / 2)
          try {
            for (let i = 0; i < fps * 2; i++) {
              motor.step(world.timestep, {forward: true}, facing)
              world.step()
              if (returning ? body.translation().x < -2 : body.translation().x > 2) {
                break
              }
            }
            expect(returning ? body.translation().x < -2 : body.translation().x > 2).toBe(true)
            for (let i = 0; i < fps / 2; i++) {
              motor.step(world.timestep, {}, facing)
              world.step()
            }
            expect(body.translation().y).toBeCloseTo(tower.floorY + 0.02, 2)
          } finally {
            motor.dispose()
            world.free()
          }
        })
      }
    }
  }
  test('the tower leaves tunnel clearance and headroom below the glass', () => {
    expect(tower.z + tower.radius).toBeLessThan(lowerGallery.tunnel.north[1] - 3.5)
    expect(tower.floorY + tower.height + 1.8).toBeLessThan(-0.12)
    expect(floorHeight([tower.x, tower.floorY + tower.height + 1.6, tower.z])).toBe(-4.5)
    expect(floorHeight([tower.x, 1.6, tower.z])).toBe(0)
    // Due south, between both bridges
    expect(towerFloorHeight(tower.x, tower.z + tower.radius + 0.01)).toBeUndefined()
    expect(floorHeight([tower.x, -6.4, (ramp.startZ + ramp.endZ) / 2])).toBe(-11)
  })
  test('the visible deck and cylindrical top match collision and navigation heights', () => {
    const material = new MeshBasicMaterial
    const meshes = [new Mesh(geometry, material)]
    for (const mesh of meshes) {
      mesh.updateMatrixWorld(true)
    }
    const world = createWorld()
    try {
      world.step()
      const points = [
        ...[-0.35, 0, 0.35].flatMap(x => [ramp.startZ + 0.3, -28, ramp.endZ - 0.1, ramp.endZ + 0.1, tower.z].map(z => [x, z] as const)),
        // along both bridges, out onto their fillets by the walls
        ...towerBridges.flatMap(({angle, wallDistance}) => [tower.radius + 0.05, 5, wallDistance - 0.3].flatMap(along => [-0.6, 0, 0.6].map(across => [tower.x + Math.cos(angle) * along, tower.z + across] as const))),
      ]
      for (const [x, z] of points) {
        const origin = new Vector3(x, -2, z)
        const direction = new Vector3(0, -1, 0)
        const height = towerFloorHeight(x, z)!
        const deckRay = new Raycaster(origin, direction)
        expect(deckRay.intersectObjects(meshes)[0].point.y).toBeCloseTo(height, 5)
        expect(world.castRay(new RAPIER.Ray(origin, direction), 10, true)!.timeOfImpact).toBeCloseTo(origin.y - height, 4)
      }
    } finally {
      world.free()
      material.dispose()
    }
  })
  for (const {side, angle, wallDistance} of towerBridges) {
    for (const fps of [30, 60, 120]) {
      for (const sprint of [false, true]) {
        test(`walks across the ${side} bridge to its wall and back at ${fps} Hz, sprint ${sprint}`, () => {
          const world = createWorld()
          for (const part of bridgeWalls) {
            for (const args of part.geometry.collision) {
              const rotation = new Quaternion
              world.createCollider(RAPIER.ColliderDesc.trimesh(...args).setTranslation(...part.wall.center).setRotation(rotation.setFromAxisAngle(new Vector3(0, 1, 0), part.wall.rotation)))
            }
          }
          for (const mouth of [bastionMouth, climbMouth]) {
            for (const floor of mouth.floors) {
              for (const corners of slabHulls(floor, mouth.floorY - 0.24, mouth.floorY)) {
                world.createCollider(RAPIER.ColliderDesc.convexHull(corners)!)
              }
            }
          }
          world.timestep = 1 / fps
          const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(tower.x, ramp.endY + 0.04, tower.z))
          const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
          const motor = new EgoMotor(RAPIER, world, body, collider)
          const facing = new Quaternion
          const along = () => (body.translation().x - tower.x) * Math.cos(angle)
          try {
            for (const [heading, reached] of [[angle, () => along() > wallDistance - 1], [angle + Math.PI, () => along() < 0.5]] as const) {
              // Yaw 0 walks toward −z and grows counterclockwise, seen from above.
              facing.setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2 - heading)
              let arrived = false
              for (let i = 0; i < fps * 6 && !arrived; i++) {
                motor.step(world.timestep, {
                  forward: true,
                  sprint,
                }, facing)
                world.step()
                arrived = reached()
              }
              expect(arrived).toBe(true)
              for (let i = 0; i < fps; i++) {
                motor.step(world.timestep, {}, facing)
                world.step()
              }
              // on the bridge, or past its end in the doorway after a sprint
              const {x, y, z} = body.translation()
              expect(y).toBeCloseTo(floorHeight([x, y, z]) + 0.02, 2)
              expect(Math.abs(body.translation().z - tower.z)).toBeLessThan(towerBridge.width / 2)
              expect(motor.grounded).toBe(true)
            }
          } finally {
            motor.dispose()
            world.free()
          }
        })
      }
    }
  }
  for (const fps of [30, 60, 120, 240]) {
    for (const offset of [-0.35, 0, 0.35]) {
      for (const sprint of [false, true]) {
        for (const ascending of [false, true]) {
          test(`${ascending ? 'ascends' : 'descends'} the connecting ramp at ${fps} Hz, offset ${offset}, sprint ${sprint}`, () => {
            const world = createWorld()
            world.timestep = 1 / fps
            const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(tower.x + offset, (ascending ? ramp.startY : tower.floorY + tower.height) + 0.04, ascending ? ramp.startZ - 0.7 : tower.z))
            const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
            const motor = new EgoMotor(RAPIER, world, body, collider)
            const facing = new Quaternion
            facing.setFromAxisAngle(new Vector3(0, 1, 0), ascending ? Math.PI : 0)
            try {
              // Brake on entry to the small top; sprint momentum must not carry the player off its far edge.
              let reached = false
              for (let i = 0; i < fps * 6; i++) {
                motor.step(world.timestep, {
                  forward: true,
                  sprint,
                }, facing)
                world.step()
                reached = ascending ? body.translation().z > tower.z - 0.85 : body.translation().z < ramp.startZ - 0.5
                if (reached) {
                  break
                }
              }
              expect(reached).toBe(true)
              for (let i = 0; i < fps; i++) {
                motor.step(world.timestep, {}, facing)
                world.step()
              }
              expect(body.translation().y).toBeCloseTo((ascending ? tower.floorY + tower.height : ramp.startY) + 0.02, 2)
              expect(motor.grounded).toBe(true)
            } finally {
              motor.dispose()
              world.free()
            }
          })
        }
      }
    }
  }
})
