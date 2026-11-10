import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {BoxGeometry, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import lowerGallery, {oculusCornerRamps, oculusLowerRamps, oculusPlatform, oculusQuarterLandings, oculusRampLandings, oculusRamps, rampFloorHeight, tunnelFloorHeight, tunnelSlope} from '../../src/lib/gallery/lowerGallery.ts'
import OculusGroundGeometry from '../../src/lib/gallery/OculusGroundGeometry.ts'
import OculusSwitchbackRailing from '../../src/lib/gallery/railings/OculusSwitchbackRailing.ts'
import SlopedBoxGeometry from '../../src/lib/gallery/SlopedBoxGeometry.ts'
import tunnelDisplays from '../../src/lib/gallery/tunnelDisplays.ts'
import walls, {floorHeight, insideGallery, roomAt, rooms, roomVisit} from './fixtures/gallery.ts'
import {addOculusRailings} from './helpers/oculusRailings.ts'

await RAPIER.init()
const ground = new OculusGroundGeometry
const collision = colliderGeometry(ground)
afterAll(() => ground.dispose())
const {oculus, tunnel} = lowerGallery
test('the Oculus lies 3 m below Moonfall, which its tunnel ramps up to, and under the upper viewing deck', () => {
  expect(lowerGallery.floorY - oculus.floorY).toBe(3)
  expect(tunnelFloorHeight(tunnel.northZ)).toBe(oculus.floorY)
  expect(tunnelFloorHeight(tunnel.southZ)).toBe(lowerGallery.floorY)
  expect(tunnelSlope).toBeCloseTo(3 / (tunnel.southZ - tunnel.northZ))
  expect(oculusPlatform.position[1] + oculusPlatform.size[1] / 2).toBeGreaterThan(lowerGallery.floorY)
  const room = rooms.find(value => value.id === 'oculus')!
  const visit = roomVisit(room)
  expect(insideGallery(visit.position)).toBe(true)
  expect(roomAt(visit.position)).toBe('oculus')
  expect(floorHeight(visit.position)).toBe(oculus.floorY)
  for (const z of [-9.99, -6, 0, 4.49]) {
    const y = tunnelFloorHeight(z)
    expect(floorHeight([0, y + 0.02, z])).toBeCloseTo(y)
    expect(insideGallery([0, y + 1.6, z])).toBe(true)
    expect(insideGallery([0, y - 1.01, z])).toBe(false)
    expect(insideGallery([0, y + tunnel.height + 0.01, z])).toBe(false)
    expect(roomAt([0, y + 1.6, z])).toBe('exhibition')
  }
})
test('sloped floor, ceiling, display shells and upright pedestal bases have matching visible and physical surfaces', () => {
  const material = new MeshBasicMaterial
  const middleZ = (tunnel.northZ + tunnel.southZ) / 2
  const middleY = tunnelFloorHeight(middleZ)
  const floor = new SlopedBoxGeometry(tunnel.width, 0.24, tunnel.southZ - tunnel.northZ, tunnelSlope)
  floor.translate(tunnel.x, middleY - 0.12, middleZ)
  const ceiling = new SlopedBoxGeometry(tunnel.width, 0.18, tunnel.southZ - tunnel.northZ, tunnelSlope)
  ceiling.translate(tunnel.x, middleY + tunnel.height + 0.09, middleZ)
  const slabs = [floor, ceiling]
  const world = new RAPIER.World({
    x: 0,
    y: 0,
    z: 0,
  })
  try {
    const meshes = slabs.map(geometry => new Mesh(geometry, material))
    for (const slab of slabs) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(slab)))
    }
    world.step()
    for (const x of [-1.8, 0, 1.8]) {
      for (let i = 0; i <= 20; i++) {
        const z = tunnel.northZ + 0.001 + (tunnel.southZ - tunnel.northZ - 0.002) * i / 20
        const floorY = tunnelFloorHeight(z)
        for (const direction of [-1, 1]) {
          const ray = new Raycaster(new Vector3(x, floorY + 1.6, z), new Vector3(0, direction, 0))
          const height = floorY + (direction > 0 ? tunnel.height : 0)
          expect(ray.intersectObjects(meshes)[0].point.y).toBeCloseTo(height, 5)
          const physical = world.castRay(new RAPIER.Ray(ray.ray.origin, ray.ray.direction), 5, true)!
          expect(ray.ray.origin.y + direction * physical.timeOfImpact).toBeCloseTo(height, 5)
        }
      }
    }
    for (const display of tunnelDisplays) {
      for (const exhibit of display.exhibits) {
        expect(exhibit.position[1]).toBeCloseTo(tunnelFloorHeight(exhibit.position[2]))
        const pedestal = new SlopedBoxGeometry(1.15, 0.9, 1.15, 0, tunnelSlope)
        pedestal.translate(exhibit.position[0], exhibit.position[1] + 0.45, exhibit.position[2])
        const positions = pedestal.getAttribute('position')
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i)
          expect(y).toBeCloseTo(y > exhibit.position[1] + 0.45 ? exhibit.position[1] + 0.9 : tunnelFloorHeight(positions.getZ(i)), 5)
        }
        pedestal.dispose()
      }
    }
  } finally {
    world.free()
    material.dispose()
    for (const slab of slabs) {
      slab.dispose()
    }
  }
})
for (const lower of oculusLowerRamps) {
  const upper = oculusRamps.find(flight => flight.side === lower.side)!
  const landing = oculusRampLandings.find(value => value.side === lower.side)!
  const corner = oculusCornerRamps.find(value => value.side === lower.side)!
  const quarter = oculusQuarterLandings.find(value => value.side === lower.side)!
  describe(`${lower.side} two-flight switchback`, () => {
    test('a short flight from the center turns onto the lower flight, opposite flights meet a shared landing and every rail post is supported', () => {
      expect(corner.floorY).toBe(-11)
      expect(corner.floorY + corner.rise).toBe(lower.floorY)
      expect(corner.rise / corner.run).toBeCloseTo(lower.rise / lower.run)
      expect(Math.sign(corner.startX - lower.x)).toBe(-Math.sign(lower.x))
      expect(quarter.position[1] + quarter.size[1] / 2).toBe(lower.floorY)
      expect(quarter.position[2] - quarter.size[2] / 2).toBeCloseTo(oculusPlatform.position[2] + oculusPlatform.size[2] / 2)
      expect(lower.floorY + lower.rise).toBeCloseTo(upper.floorY)
      expect(lower.startZ + lower.run).toBeCloseTo(upper.startZ)
      expect(landing.position[1] + landing.size[1] / 2).toBe(upper.floorY)
      const material = new MeshBasicMaterial
      const mesh = new Mesh(ground, material)
      const floor = new BoxGeometry(oculus.size[0], 0.24, oculus.size[1])
      floor.translate(oculus.center[0], oculus.floorY - 0.12, oculus.center[1])
      const meshes = [mesh, new Mesh(floor, material)]
      try {
        for (const flight of [lower, upper]) {
          for (const t of [0.001, 0.1, 0.5, 0.9, 0.999]) {
            const z = flight.startZ + flight.direction * flight.run * t
            const top = flight.floorY + t * flight.rise
            const ray = new Raycaster(new Vector3(flight.x, -2, z), new Vector3(0, -1, 0))
            const hits = ray.intersectObject(mesh)
            expect(hits).toHaveLength(1)
            expect(hits[0].point.y).toBeCloseTo(top, 5)
            expect(rampFloorHeight(flight.x, z)).toBeCloseTo(top, 5)
            expect(floorHeight([flight.x, top + 1.6, z])).toBeCloseTo(top, 5)
          }
        }
        for (const t of [0.001, 0.1, 0.5, 0.9, 0.999]) {
          const x = corner.startX + corner.direction * corner.run * t
          const top = corner.floorY + t * corner.rise
          const ray = new Raycaster(new Vector3(x, -2, corner.z), new Vector3(0, -1, 0))
          const hits = ray.intersectObject(mesh)
          expect(hits).toHaveLength(1)
          expect(hits[0].point.y).toBeCloseTo(top, 5)
          expect(rampFloorHeight(x, corner.z)).toBeCloseTo(top, 5)
        }
        const rail = new OculusSwitchbackRailing(lower.side)
        for (const post of rail.posts) {
          const foot = post.position[1] - post.height / 2
          const ray = new Raycaster(new Vector3(post.position[0], foot + 0.1, post.position[2]), new Vector3(0, -1, 0), 0, 0.2)
          const hit = ray.intersectObjects(meshes)[0]
          expect(hit).toBeDefined()
          expect(hit.point.y).toBeCloseTo(foot, 4)
        }
      } finally {
        floor.dispose()
        material.dispose()
      }
    })
    for (const fps of [30, 60, 120]) {
      for (const sprint of [false, true]) {
        for (const ascending of [false, true]) {
          test(`${ascending ? 'ascends' : 'descends'} all three flights, the corner and the U-turn with real walls/rails at ${fps} Hz, sprint ${sprint}`, () => {
            const world = new RAPIER.World({
              x: 0,
              y: -9.81,
              z: 0,
            })
            world.timestep = 1 / fps
            world.createCollider(RAPIER.ColliderDesc.trimesh(...collision))
            world.createCollider(RAPIER.ColliderDesc.cuboid(oculus.size[0] / 2, 0.12, oculus.size[1] / 2).setTranslation(oculus.center[0], oculus.floorY - 0.12, oculus.center[1]))
            const wall = walls.find(value => value.id === `oculus-${lower.side}`)!
            const wallGeometry = createArchitectureGeometry(wall)
            const rotation = new Quaternion
            rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
            for (const collider of wallGeometry.collision) {
              world.createCollider(RAPIER.ColliderDesc.trimesh(...collider).setTranslation(...wall.center).setRotation(rotation))
            }
            addOculusRailings(world)
            const path = [
              [corner.startX - corner.direction * 0.6, corner.floorY, corner.z],
              [quarter.position[0], lower.floorY, quarter.position[2]],
              [lower.x, upper.floorY, landing.position[2]],
              [upper.x, upper.floorY, landing.position[2]],
              [upper.x, upper.floorY + upper.rise, upper.startZ - upper.run - 0.8],
            ]
            if (!ascending) {
              path.reverse()
            }
            const [x, y, z] = path[0]
            const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y + 0.04, z))
            const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
            const motor = new EgoMotor(RAPIER, world, body, collider)
            const facing = new Quaternion
            try {
              for (const [index, [targetX, targetY, targetZ]] of path.slice(1).entries()) {
                let reached = false
                for (let frame = 0; frame < fps * 8; frame++) {
                  const position = body.translation()
                  const dx = targetX - position.x
                  const dz = targetZ - position.z
                  if (Math.hypot(dx, dz) < 0.25) {
                    reached = true
                    break
                  }
                  facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
                  // Slow down for the tight turn; sprinting the straight runs must still work.
                  motor.step(world.timestep, {
                    forward: true,
                    sprint: sprint && path[index][1] !== path[index + 1][1] && Math.hypot(dx, dz) > 1.5,
                  }, facing)
                  world.step()
                }
                expect(reached).toBe(true)
                for (let frame = 0; frame < fps / 2; frame++) {
                  motor.step(world.timestep, {}, facing)
                  world.step()
                }
                expect(body.translation().y).toBeCloseTo(targetY + 0.02, 2)
                expect(motor.grounded).toBe(true)
                const position = body.translation()
                expect(insideGallery([position.x, position.y, position.z])).toBe(true)
              }
            } finally {
              motor.dispose()
              wallGeometry.dispose()
              world.free()
            }
          })
        }
      }
    }
  })
}
test('sloped boxes reject inverted caps and nonfinite dimensions', () => {
  expect(() => new SlopedBoxGeometry(2, 0.2, 3, 1, 0)).toThrow(RangeError)
  expect(() => new SlopedBoxGeometry(2, 1, 3, NaN)).toThrow(RangeError)
  expect(() => new SlopedBoxGeometry(0, 1, 3, 0)).toThrow(RangeError)
})
