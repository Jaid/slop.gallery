import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {Wall} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {ExhibitionTunnelSlabGeometry, PolygonalSlabGeometry} from '../../src/lib/gallery/ExhibitionTunnelGeometry.ts'
import lowerGallery, {tunnelDiagonalEast, tunnelDiagonalFloorY, tunnelDiagonalHeading, tunnelDiagonalPoint, tunnelDiagonalYaw, tunnelFloorHeight, tunnelSlope} from '../../src/lib/gallery/lowerGallery.ts'
import oculusBalcony from '../../src/lib/gallery/oculusBalcony.ts'
import SlopedBoxGeometry from '../../src/lib/gallery/SlopedBoxGeometry.ts'
import staircase from '../../src/lib/gallery/staircase.ts'
import tunnelDisplays, {displayStairway, tunnelDisplayWindow} from '../../src/lib/gallery/tunnelDisplays.ts'
import walls, {floorHeight, galleryPlacement, insideGallery, roomAt} from './fixtures/gallery.ts'

await RAPIER.init()
const {oculus, tunnel} = lowerGallery
const balconyY = oculusBalcony.position[1] + oculusBalcony.size[1] / 2
type Display = (typeof tunnelDisplays)[number]

/** Build the colliders between the Oculus balcony and the display: balcony, Oculus side wall, stairway, and display shell. */
function stairwayWorld(display: Display) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 60
  for (const wall of [walls.find(value => value.id === `oculus-${display.side}`)!, ...display.stairway.walls]) {
    const geometry = createArchitectureGeometry(wall)
    const wallRotation = new Quaternion
    wallRotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
    for (const collision of geometry.collision) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...collision).setTranslation(...wall.center).setRotation(wallRotation))
    }
    geometry.dispose()
  }
  const box = (position: Vec3, size: Vec3, rotation?: Vec3) => {
    const desc = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...position)
    if (rotation) {
      const quat = new Quaternion
      desc.setRotation(quat.setFromEuler(new Euler(...rotation)))
    }
    return world.createCollider(desc)
  }
  box(oculusBalcony.position, oculusBalcony.size)
  for (const {position, size, yaw} of display.stairway.treads) {
    box(position, size, yaw ? [0, yaw, 0] : undefined)
  }
  for (const slab of display.stairway.slabs) {
    if (slab.kind === 'box') {
      box(slab.position, slab.size, slab.rotation)
    } else {
      const geom = new PolygonalSlabGeometry(slab.polygon, slab.bottom, slab.top)
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geom)))
      geom.dispose()
    }
  }
  for (const {position, rotation, size} of display.stairway.roofs) {
    box(position, size, rotation)
  }
  for (const {position, rotation, size} of display.shell) {
    const slab = new SlopedBoxGeometry(...size, tunnelSlope)
    const shellRot = new Quaternion
    shellRot.setFromEuler(new Euler(...rotation ?? [0, 0, 0]))
    world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(slab)).setTranslation(...position).setRotation(shellRot))
    slab.dispose()
  }
  return world
}
function wallMeshes(list: Array<Wall>, material: MeshBasicMaterial) {
  const geometries = list.map(wall => createArchitectureGeometry(wall))
  const meshes = list.flatMap((wall, i) => [geometries[i].surface, ...geometries[i].trim].map(part => {
    const mesh = new Mesh(part, material)
    mesh.position.set(...wall.center)
    mesh.rotation.y = wall.rotation
    mesh.updateMatrixWorld(true)
    return mesh
  }))
  return {
    meshes,
    dispose: () => {
      for (const geometry of geometries) {
        geometry.dispose()
      }
    },
  }
}
describe('beveled tunnel with display rooms and asymmetric staff stairways', () => {
  test('both portals and floor bounds follow the beveled tunnel, as wide as the stairway arriving in Moonfall, and the displays are the Exhibition’s', () => {
    expect(tunnel.width).toBe(staircase.lowerWidth)
    expect(tunnel.northX).toBe(0)
    expect(tunnel.southX).toBe(lowerGallery.moonfall.center[0])
    for (const id of ['oculus-south', 'moonfall-north']) {
      const wall = walls.find(value => value.id === id)!
      expect(wall.holes![0].width).toBe(tunnel.width)
      expect(wall.holes![0].u).toBe(0)
    }
    expect(walls.find(wall => wall.id === 'oculus-south')!.holes).toHaveLength(1)
    expect(tunnelDisplays).toHaveLength(2)
    for (const display of tunnelDisplays) {
      expect(display.exhibits).toHaveLength(3)
      const midS = (display.northS + display.southS) / 2
      const [midX, midZ] = tunnelDiagonalPoint(midS, (display.frontAcross + display.backAcross) / 2)
      const midFloor = tunnelDiagonalFloorY(midS)
      expect(insideGallery([midX, midFloor + 1.6, midZ])).toBe(true)
      expect(roomAt([midX, midFloor + 1.6, midZ])).toBe('exhibition')
      const [tunnelX, tunnelZ] = tunnelDiagonalPoint(midS, display.direction * 1.8)
      expect(insideGallery([tunnelX, midFloor + 1.6, tunnelZ])).toBe(true)
      // Displays stay strictly between Oculus (z >= -15) and Moonfall (z <= 4.5), and east of Bastion (x > -20.3).
      for (const [cx, cz] of display.polygon) {
        expect(cz).toBeGreaterThan(-15)
        expect(cz).toBeLessThan(4.5)
        expect(cx).toBeGreaterThan(-20)
      }
      for (const [wx, wz] of display.stairway.waypoints) {
        expect(wz).toBeLessThan(4.5)
        expect(wx).toBeGreaterThan(-20)
      }
      for (const exhibit of display.exhibits) {
        expect(exhibit.s - display.northS).toBeGreaterThan(2.5)
        expect(display.southS - exhibit.s).toBeGreaterThan(2.2)
      }
    }
    const exhibitIds = new Set(tunnelDisplays.flatMap(display => display.exhibits.map(exhibit => exhibit.id)))
    expect(exhibitIds.size).toBe(6)
  })
  for (const display of tunnelDisplays) {
    const {corners, cutout, door, flights, landing, ramp, waypoints} = display.stairway
    const sign = display.direction
    const floorAtSouth = tunnelDiagonalFloorY(display.southS)
    test(`${display.side}: a door in the Oculus’ side wall at the balcony’s end opens onto the stairway, whose even steps and floors are the Exhibition’s`, () => {
      const balconyNorthZ = oculusBalcony.position[2] - oculusBalcony.size[2] / 2
      expect(door[1]).toBe(balconyY)
      expect(door[2] - displayStairway.doorWidth / 2 - wallOpeningTrim).toBeGreaterThan(balconyNorthZ)
      expect(door[2] + displayStairway.doorWidth / 2 + wallOpeningTrim).toBeLessThan(tunnel.northZ - wallFace)
      const rampDrop = -ramp.ramp!.slope * ramp.ramp!.length
      expect(ramp.floor).toBe(corners[0].floor)
      expect(rampDrop).toBeGreaterThanOrEqual(0)
      expect(rampDrop).toBeLessThan(displayStairway.rise)
      const floors: Array<[number, number]> = [[balconyY, corners[0].floor], [ramp.floor - rampDrop, corners[1].floor], [corners[1].floor, landing.floor]]
      expect(landing.floor).toBeCloseTo(floorAtSouth)
      expect(flights[0].start).toEqual([door[0], balconyY, door[2]])
      expect(flights[0].entryLanding).toBeGreaterThanOrEqual(wallFace + displayStairway.threshold)
      for (const [i, flight] of flights.entries()) {
        expect(flight.start[1]).toBeCloseTo(floors[i][0])
        expect(flight.end[1]).toBeCloseTo(floors[i][1] + flight.rise)
        expect(flight.rise).toBeCloseTo(displayStairway.rise, 9)
        expect(flight.run).toBeCloseTo(displayStairway.going, 9)
      }
      const material = new MeshBasicMaterial
      const doorWalls = wallMeshes([walls.find(value => value.id === `oculus-${display.side}`)!, display.stairway.walls.find(wall => wall.holes?.length)!], material)
      try {
        for (const offset of [-0.6, 0, 0.6]) {
          for (const height of [0.1, 1.6, displayStairway.doorHeight - 0.1]) {
            const ray = new Raycaster(new Vector3(door[0] - sign * 0.5, balconyY + height, door[2] + offset), new Vector3(sign, 0, 0), 0, 1)
            expect(ray.intersectObjects(doorWalls.meshes)).toHaveLength(0)
          }
        }
        for (const [offset, height] of [[0, displayStairway.doorHeight + 0.15], [-1.2, 1.6], [1.2, 1.6]]) {
          const ray = new Raycaster(new Vector3(door[0] - sign * 0.5, balconyY + height, door[2] + offset), new Vector3(sign, 0, 0), 0, 1)
          expect(ray.intersectObjects(doorWalls.meshes).length).toBeGreaterThan(0)
        }
      } finally {
        doorWalls.dispose()
        material.dispose()
      }
      const positions: Array<[Vec3, number]> = [
        ...display.stairway.treads.map((block): [Vec3, number] => [[block.position[0], block.top + 1.6, block.position[2]], block.top]),
        ...[...corners, landing].map(({polygon, floor}): [Vec3, number] => {
          const cx = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length
          const cz = polygon.reduce((sum, [, z]) => sum + z, 0) / polygon.length
          return [[cx, floor + 1.6, cz], floor]
        }),
        ...[0.15, 0.5, 0.85].map((t): [Vec3, number] => {
          const r = ramp.ramp!
          const x = r.start[0] + r.direction[0] * r.length * t
          const z = r.start[1] + r.direction[1] * r.length * t
          const y = ramp.floor + r.length * t * r.slope
          return [[x, y + 1.6, z], y]
        }),
      ]
      for (const [position, floor] of positions) {
        expect(insideGallery(position)).toBe(true)
        expect(roomAt(position)).toBe('exhibition')
        expect(floorHeight(position)).toBeCloseTo(floor)
      }
      expect(waypoints).toHaveLength(4)
    })
    test(`${display.side}: the cutout in the display’s south end wall opens onto the landing up to the display’s ceiling`, () => {
      const material = new MeshBasicMaterial
      const shell = display.shell.map(({position, rotation, size}) => {
        const slab = new SlopedBoxGeometry(...size, tunnelSlope)
        const mesh = new Mesh(slab, material)
        mesh.position.set(...position)
        if (rotation) {
          mesh.rotation.set(...rotation)
        }
        mesh.updateMatrixWorld(true)
        return mesh
      })
      const landingWalls = wallMeshes(display.stairway.walls.filter(wall => wall.id.includes('landing')), material)
      const meshes = [...shell, ...landingWalls.meshes]
      const cast = (across: number, height: number) => {
        const [ox, oz] = tunnelDiagonalPoint(display.southS - 0.5, across)
        const ray = new Raycaster(new Vector3(ox, floorAtSouth + height, oz), new Vector3(tunnelDiagonalHeading[0], 0, tunnelDiagonalHeading[1]), 0, 1.5)
        return ray.intersectObjects(meshes)
      }
      try {
        expect(cutout.top).toBeCloseTo(landing.floor + landing.headroom - 0.09)
        expect(cutout.top).toBeGreaterThan(floorAtSouth + tunnel.height)
        const cutMid = (cutout.fromAcross + cutout.toAcross) / 2
        for (const across of [cutout.fromAcross + sign * 0.1, cutMid, cutout.toAcross - sign * 0.1]) {
          for (const height of [0.1, 1.6, tunnel.height - 0.15]) {
            expect(cast(across, height)).toHaveLength(0)
          }
          const [ux, uz] = tunnelDiagonalPoint(display.southS + 0.09, across)
          const up = new Raycaster(new Vector3(ux, landing.floor + 1.6, uz), new Vector3(0, 1, 0), 0, tunnel.height + 1)
          expect(up.intersectObjects(meshes)[0]?.point.y).toBeCloseTo(tunnelDiagonalFloorY(display.southS + 0.09) + tunnel.height, 3)
        }
        expect(cast(cutout.fromAcross - sign * 0.05, 1.6).length).toBeGreaterThan(0)
        const [jx, jz] = tunnelDiagonalPoint(display.southS + 0.05, cutMid)
        const jamb = new Raycaster(new Vector3(jx, landing.floor + 1.6, jz), new Vector3(sign * tunnelDiagonalEast[0], 0, sign * tunnelDiagonalEast[1]), 0, displayStairway.cutoutWidth)
        expect(jamb.intersectObjects(meshes)[0]?.distance).toBeCloseTo(displayStairway.cutoutWidth / 2)
      } finally {
        for (const mesh of shell) {
          mesh.geometry.dispose()
        }
        landingWalls.dispose()
        material.dispose()
      }
    })
    test(`${display.side}: the shell’s floor, ceiling, back and north walls overlap at their seams instead of only touching along an edge`, () => {
      const solid = ([x, y, z]: Vec3) => display.shell.some(({position, rotation, size: [width, height, depth]}) => {
        const local = new Vector3(x - position[0], y - position[1], z - position[2])
        const turn = new Quaternion
        local.applyQuaternion(turn.setFromEuler(new Euler(...rotation ?? [0, 0, 0])).invert())
        return Math.abs(local.x) <= width / 2 && Math.abs(local.z) <= depth / 2 && Math.abs(local.y - local.z * tunnelSlope) <= height / 2
      })
      const floorAt = (s: number) => tunnelDiagonalFloorY(display.southS) + (s - display.southS) * tunnelSlope
      const behind = 0.05
      const midS = (display.northS + display.southS) / 2
      const backOut = display.backAcross + sign * behind
      const northOut = display.northS - behind
      const seams: Array<[string, number, number, number]> = [
        ['floor and back wall', midS, backOut, floorAt(midS) - behind],
        ['ceiling and back wall', midS, backOut, floorAt(midS) + tunnel.height + behind],
        ['floor and north wall', northOut, (display.frontAcross + display.backAcross) / 2, floorAt(northOut) - behind],
        ['ceiling and north wall', northOut, (display.frontAcross + display.backAcross) / 2, floorAt(northOut) + tunnel.height + behind],
        ['back and north walls', northOut, backOut, floorAt(northOut) + tunnel.height / 2],
        ['floor, back and north walls', northOut, backOut, floorAt(northOut) - behind],
      ]
      for (const [seam, s, across, y] of seams) {
        const [x, z] = tunnelDiagonalPoint(s, across)
        expect(solid([x, y, z]), seam).toBe(true)
      }
    })
    for (const returning of [false, true]) {
      test(`${display.side}: the player walks ${returning ? 'up from the display to the balcony' : 'down from the balcony into the display'}`, () => {
        const world = stairwayWorld(display)
        const cutMid = (cutout.fromAcross + cutout.toAcross) / 2
        const landPt = tunnelDiagonalPoint(display.southS + 0.8, cutMid)
        const dispSouthPt = tunnelDiagonalPoint(display.southS - 1, cutMid)
        const dispMidPt = tunnelDiagonalPoint((display.northS + display.southS) / 2, (display.frontAcross + display.backAcross) / 2)
        const path: Array<readonly [number, number]> = [
          [door[0] - sign * 1.5, door[2]],
          waypoints[1],
          waypoints[2],
          landPt,
          dispSouthPt,
          dispMidPt,
        ]
        if (returning) {
          path.reverse()
        }
        const [start] = path
        const startY = returning ? tunnelDiagonalFloorY((display.northS + display.southS) / 2) : balconyY
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start[0], startY + 0.04, start[1]))
        const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
        const motor = new EgoMotor(RAPIER, world, body, collider)
        const facing = new Quaternion
        try {
          for (const target of path.slice(1)) {
            const distance = () => Math.hypot(body.translation().x - target[0], body.translation().z - target[1])
            for (let i = 0; i < 60 * 14 && distance() > 0.2; i++) {
              const {x, y, z} = body.translation()
              facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(x - target[0], z - target[1]))
              motor.step(world.timestep, {forward: true}, facing)
              world.step()
              expect(insideGallery([x, y + 1.6, z])).toBe(true)
              expect(roomAt([x, y + 1.6, z])).toBe(Math.abs(x - oculus.center[0]) <= oculus.size[0] / 2 && z <= tunnel.northZ ? 'oculus' : 'exhibition')
            }
            expect(distance()).toBeLessThan(0.2)
          }
          expect(body.translation().y).toBeCloseTo((returning ? balconyY : tunnelDiagonalFloorY((display.northS + display.southS) / 2)) + 0.02, 1)
          expect(motor.grounded).toBe(true)
          expect(motor.crouching).toBe(false)
        } finally {
          motor.dispose()
          world.free()
        }
      })
    }
    test(`${display.side}: windows are real openings with glass collision, solid sills and a closed room shell`, () => {
      const wall = walls.find(value => value.id === `exhibition-${display.side}`)!
      const geometry = createArchitectureGeometry(wall)
      const material = new MeshBasicMaterial
      const opaque = [geometry.surface, ...geometry.trim].map(part => new Mesh(part, material))
      const glass = geometry.glazing.map(part => new Mesh(part, material))
      const world = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      try {
        expect(glass).toHaveLength(1)
        for (const collision of geometry.collision) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(...collision))
        }
        world.step()
        for (const u of [-4.8, -2.5, 0, 2.5, 4.8]) {
          for (const y of [0.6, 1.62, 2.8]) {
            for (const side of [-1, 1]) {
              const origin = new Vector3(u, y + u * wall.slope!, side)
              const direction = new Vector3(0, 0, -side)
              const ray = new Raycaster(origin, direction, 0, 2)
              expect(ray.intersectObjects(opaque)).toHaveLength(0)
              const hit = ray.intersectObjects(glass)[0]
              expect(hit.point.z).toBeCloseTo((wallFace + side * tunnelDisplayWindow.glassThickness) / 2, 6)
              expect(world.castRay(new RAPIER.Ray(origin, direction), 2, true)!.timeOfImpact).toBeCloseTo(hit.distance, 6)
            }
          }
        }
        for (const [u, y] of [[0, 0.3], [0, 3], [-tunnelDisplayWindow.width / 2 - 0.2, 1.6], [tunnelDisplayWindow.width / 2 + 0.2, 1.6]]) {
          const holeCenter = wall.holes![0].u
          const surroundRay = new Raycaster(new Vector3(holeCenter + u, y + (holeCenter + u) * wall.slope!, 1), new Vector3(0, 0, -1), 0, 2)
          expect(surroundRay.intersectObjects(opaque).length).toBeGreaterThan(0)
        }
      } finally {
        world.free()
        geometry.dispose()
        material.dispose()
      }
      const shell = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      try {
        for (const box of display.shell) {
          const slab = new SlopedBoxGeometry(...box.size, tunnelSlope)
          const rot = new Quaternion
          rot.setFromEuler(new Euler(...box.rotation ?? [0, 0, 0]))
          shell.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(slab)).setTranslation(...box.position).setRotation(rot))
          slab.dispose()
        }
        shell.step()
        const midS = (display.northS + display.southS) / 2
        const [ox, oz] = tunnelDiagonalPoint(midS, display.frontAcross + sign * 0.45)
        const origin = new Vector3(ox, tunnelDiagonalFloorY(midS) + 1.6, oz)
        for (const direction of [
          new Vector3(sign * tunnelDiagonalEast[0], 0, sign * tunnelDiagonalEast[1]),
          new Vector3(0, 1, 0),
          new Vector3(0, -1, 0),
          new Vector3(tunnelDiagonalHeading[0], 0, tunnelDiagonalHeading[1]),
          new Vector3(-tunnelDiagonalHeading[0], 0, -tunnelDiagonalHeading[1]),
        ]) {
          expect(shell.castRay(new RAPIER.Ray(origin, direction), 12, true)).not.toBeNull()
        }
      } finally {
        shell.free()
      }
    })
    test(`${display.side}: glass blocks artwork placement through the display window`, () => {
      const [ox, oz] = tunnelDiagonalPoint(display.winCenterS)
      const hit = galleryPlacement.findPlacement([ox, tunnelDiagonalFloorY(display.winCenterS) + 1.6, oz], [sign * tunnelDiagonalEast[0], 0, sign * tunnelDiagonalEast[1]], 1, 1, [])
      expect(hit?.wallId).toBe(`exhibition-${display.side}`)
      expect(hit?.valid).toBe(false)
    })
    for (const fps of [30, 60, 120]) {
      for (const jump of [false, true]) {
        test(`${display.side}: the player cannot enter through the glass at ${fps} Hz, jump ${jump}`, () => {
          const world = new RAPIER.World({
            x: 0,
            y: -9.81,
            z: 0,
          })
          world.timestep = 1 / fps
          const wall = walls.find(value => value.id === `exhibition-${display.side}`)!
          const geometry = createArchitectureGeometry(wall)
          for (const collision of geometry.collision) {
            const wallRotation = new Quaternion
            wallRotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
            world.createCollider(RAPIER.ColliderDesc.trimesh(...collision).setTranslation(...wall.center).setRotation(wallRotation))
          }
          const floor = new ExhibitionTunnelSlabGeometry(0, 0.24)
          world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(floor)))
          floor.dispose()
          const [sx, sz] = tunnelDiagonalPoint(display.winCenterS)
          const startFloor = tunnelFloorHeight(sx, sz)!
          const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(sx, startFloor + 0.04, sz))
          const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
          const motor = new EgoMotor(RAPIER, world, body, collider)
          const facing = new Quaternion
          facing.setFromAxisAngle(new Vector3(0, 1, 0), -sign * Math.PI / 2 + tunnelDiagonalYaw)
          try {
            for (let i = 0; i < fps * 3; i++) {
              motor.step(world.timestep, {
                forward: true,
                sprint: true,
                jump: jump && i === fps,
              }, facing)
              world.step()
            }
            const pos = body.translation()
            const across = pos.x * tunnelDiagonalEast[0] + (pos.z - tunnel.northBendZ) * tunnelDiagonalEast[1]
            expect(Math.abs(across)).toBeLessThan(tunnel.width / 2 - 0.25)
            expect(Math.abs(across)).toBeGreaterThan(1)
            expect(insideGallery([pos.x, pos.y, pos.z])).toBe(true)
          } finally {
            motor.dispose()
            world.free()
            geometry.dispose()
          }
        })
      }
    }
  }
})
