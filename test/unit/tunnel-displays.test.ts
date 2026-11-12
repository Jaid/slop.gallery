import type {Vec3} from '../../src/lib/gallery/types.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {frameToWorld, tunnelFloorAt, tunnelFrame, tunnelSlopeHeight, worldToFrame} from '../../src/lib/gallery/exhibitionTunnel.ts'
import {insidePolygon, polygonCentroid} from '../../src/lib/gallery/floorPolygons.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import oculusBalcony from '../../src/lib/gallery/oculusBalcony.ts'
import oculusTower from '../../src/lib/gallery/oculusTower.ts'
import SlopedBoxGeometry from '../../src/lib/gallery/SlopedBoxGeometry.ts'
import tunnelDisplays, {displayStairway, tunnelDisplayWindow} from '../../src/lib/gallery/tunnelDisplays.ts'
import walls, {floorHeight, galleryPlacement, insideGallery, roomAt} from './fixtures/gallery.ts'
import {addGeometries, addWalls, directionFromFrame, frameBox, frameMatrix, fromFrame, levelSlab, tunnelSlabGeometries, walk, wallMeshes} from './helpers/exhibitionTunnel.ts'

await RAPIER.init()
type Point = readonly [number, number]
type Display = (typeof tunnelDisplays)[number]
const {oculus, tunnel} = lowerGallery
const {half} = tunnelFrame
const balconyY = oculusBalcony.position[1] + oculusBalcony.size[1] / 2
const oculusSouth = walls.find(wall => wall.id === 'oculus-south')!
/** the display’s shell in the museum’s meters */
const shellGeometries = (display: Display) => display.shell.map(({position, size}) => frameBox(position, size))
/** the stairway’s floors, ceilings, header and roofs in the museum’s meters */
function stairwayGeometries(display: Display) {
  const {slabs, roofs} = display.stairway
  return [
    ...slabs.map(({polygon, bottom, top}) => levelSlab(polygon.map(point => frameToWorld(point)), bottom, top)),
    ...roofs.map(({position, rotation, size}) => {
      const geometry = new SlopedBoxGeometry(...size, 0)
      const turn = new Quaternion
      geometry.applyQuaternion(turn.setFromEuler(new Euler(...rotation)))
      geometry.translate(...position)
      return geometry.applyMatrix4(frameMatrix)
    }),
  ]
}
/** the colliders between the Oculus balcony and the display: the balcony, the Oculus’ south wall with its doors, the stairway and the display’s shell */
function stairwayWorld(display: Display) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 60
  addWalls(world, [oculusSouth, ...display.stairway.walls])
  world.createCollider(RAPIER.ColliderDesc.cuboid(...oculusBalcony.size.map(size => size / 2) as Vec3).setTranslation(...oculusBalcony.position))
  const rotation = new Quaternion
  rotation.setFromAxisAngle(new Vector3(0, 1, 0), tunnelFrame.yaw)
  for (const block of display.stairway.treads) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(block.size[0] / 2, block.size[1] / 2, block.size[2] / 2).setTranslation(...fromFrame(block.position)).setRotation(rotation))
  }
  const geometries = [...stairwayGeometries(display), ...shellGeometries(display)]
  addGeometries(world, geometries)
  for (const geometry of geometries) {
    geometry.dispose()
  }
  return world
}
/** where the display’s and its stairway’s parts lie, in the museum’s meters */
function places(display: Display) {
  const {entry, middle, landing, cutout, flights} = display.stairway
  const [northZ, southZ] = [display.center[1] - display.size[1] / 2, display.center[1] + display.size[1] / 2]
  const cutoutX = (cutout.from + cutout.to) / 2
  return {
    northZ,
    southZ,
    cutoutX,
    entry: frameToWorld(polygonCentroid(entry.polygon)),
    upperTop: frameToWorld([flights[0].start[0], flights[0].start[2] + 0.3]),
    middle: frameToWorld(polygonCentroid(middle.polygon)),
    lowerFoot: frameToWorld([flights[1].start[0], polygonCentroid(landing.polygon)[1]]),
    landing: frameToWorld([cutoutX, polygonCentroid(landing.polygon)[1]]),
    cutout: frameToWorld([cutoutX, southZ + 0.09]),
    inside: frameToWorld([cutoutX, southZ - 1]),
    center: frameToWorld(display.center),
  }
}
describe('displays behind both walls of the tunnel’s diagonal, reached from the Oculus balcony', () => {
  test('the displays line the diagonal, behind windows in its rising walls, and are the Exhibition’s', () => {
    expect(tunnel.width).toBe(oculusTower.radius * 2)
    expect(tunnelDisplays.map(display => display.side)).toEqual(['west', 'east'])
    // The tunnel arrives in the middle of both walls, and the staff doors flank it in the Oculus’ south wall.
    expect(oculusSouth.holes!.map(hole => hole.name)).toEqual(['exhibition', 'west_staff_door', 'east_staff_door'])
    for (const display of tunnelDisplays) {
      const sign = display.direction
      expect(display.frontX).toBeCloseTo(sign * half, 9)
      expect(display.exhibits).toHaveLength(3)
      const [northZ, southZ] = [display.center[1] - display.size[1] / 2, display.center[1] + display.size[1] / 2]
      // in the stretch where the tunnel’s floor slopes, as the display’s does, its window and casing clear of the elbows
      expect(display.window[0] - wallOpeningTrim).toBeGreaterThan(tunnelFrame.elbow)
      expect(display.window[1] + wallOpeningTrim).toBeLessThan(tunnelFrame.length - tunnelFrame.elbow)
      // long enough to show three exhibits with room to walk round their pedestals
      expect(display.size[1]).toBeGreaterThan(14)
      for (const z of [northZ + 0.5, display.center[1], southZ - 0.5]) {
        const [x, worldZ] = frameToWorld([display.center[0], z])
        const floor = tunnelSlopeHeight(z)
        expect(insideGallery([x, floor + 1.6, worldZ])).toBe(true)
        expect(roomAt([x, floor + 1.6, worldZ])).toBe('exhibition')
        expect(floorHeight([x, floor + 1.6, worldZ])).toBeCloseTo(floor, 9)
      }
      // behind the display’s back wall, between it and the stairway, and beyond the stairway’s outer wall
      for (const x of [display.backX + sign * 0.09, display.backX + sign * (0.18 + displayStairway.width + 0.3)]) {
        const [worldX, worldZ] = frameToWorld([x, display.center[1]])
        expect(insideGallery([worldX, tunnelSlopeHeight(display.center[1]) + 1.6, worldZ])).toBe(false)
      }
      for (const exhibit of display.exhibits) {
        expect(Math.abs(exhibit.position[0] - display.center[0]) + 0.7).toBeLessThan(display.size[0] / 2)
        expect(Math.abs(exhibit.position[2] - display.center[1]) + 0.7).toBeLessThan(display.size[1] / 2)
      }
    }
    // The displays aren’t symmetric: the west one starts and ends further down the diagonal, behind the turn out of the Oculus.
    const [west, east] = tunnelDisplays
    expect(west.center[1]).toBeGreaterThan(east.center[1] + 1)
    const exhibitIds = new Set(tunnelDisplays.flatMap(display => display.exhibits.map(exhibit => exhibit.id)))
    expect(exhibitIds.size).toBe(6)
  })
  test('every part of every display and stairway keeps clear of the others, of the tunnel, of the Oculus and of Moonfall', () => {
    const samples = tunnelDisplays.map(display => display.stairway.air.flatMap(({polygon}) => {
      const points: Array<Point> = []
      const xs = polygon.map(([x]) => x)
      const zs = polygon.map(([, z]) => z)
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.2) {
        for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.2) {
          if (insidePolygon(polygon, x, z)) {
            points.push([x, z])
          }
        }
      }
      return points
    }))
    for (const [index, points] of samples.entries()) {
      const other = tunnelDisplays[1 - index]
      for (const [x, z] of points) {
        expect(tunnelFloorAt(x, z)).toBeUndefined()
        expect(other.stairway.air.some(({polygon}) => insidePolygon(polygon, x, z))).toBe(false)
        // inside neither the Oculus nor Moonfall: the doors’ floors start at the Oculus’ wall’s center line, like the tunnel’s, and the landings stay behind Moonfall’s wall
        const inOculus = Math.abs(x - oculus.center[0]) < oculus.size[0] / 2 + wallFace / 2 && z < tunnel.north[1] - 1e-6
        const {moonfall} = lowerGallery
        const inMoonfall = Math.abs(x - moonfall.center[0]) < moonfall.size[0] / 2 + wallFace / 2 && z > tunnel.south[1] - wallFace / 2
        if (inOculus || inMoonfall) {
          throw new Error(`The ${tunnelDisplays[index].side} display’s air reaches into ${inOculus ? 'the Oculus' : 'Moonfall'} at ${x}, ${z}.`)
        }
      }
    }
  })
  for (const display of tunnelDisplays) {
    const {cutout, door, entry, flights, landing, middle} = display.stairway
    const sign = display.direction
    test(`${display.side}: a door in the Oculus’ south wall at the balcony opens onto the stairway, whose even steps and floors are the Exhibition’s`, () => {
      expect(door[1]).toBe(balconyY)
      expect(door[2]).toBe(tunnel.north[1])
      // over the balcony, between the side walls and clear of the tunnel’s opening
      expect(Math.abs(door[0]) + displayStairway.doorWidth / 2 + wallOpeningTrim).toBeLessThan(oculus.size[0] / 2 - wallFace)
      expect(Math.abs(door[0]) - displayStairway.doorWidth / 2 - wallOpeningTrim).toBeGreaterThan(half + wallOpeningTrim)
      expect(Math.sign(door[0])).toBe(sign)
      const hole = oculusSouth.holes!.find(value => value.name === `${display.side}_staff_door`)!
      expect(hole.bottom).toBeCloseTo(balconyY - oculus.floorY, 9)
      expect(hole.width).toBe(displayStairway.doorWidth)
      // Each flight sets off from the floor above and ends a step over the one below, and every step rises alike.
      expect(entry.floor).toBe(balconyY)
      // The landing lies level with the display’s floor at its south end.
      expect(landing.floor).toBeCloseTo(tunnelSlopeHeight(display.center[1] + display.size[1] / 2), 9)
      const floors: Array<[number, number]> = [[balconyY, middle.floor], [middle.floor, landing.floor]]
      for (const [i, flight] of flights.entries()) {
        expect(flight.start[1]).toBeCloseTo(floors[i][0], 9)
        expect(flight.end[1]).toBeCloseTo(floors[i][1] + flight.rise, 9)
        expect(flight.rise).toBeCloseTo(flights[0].rise, 9)
        expect(Math.abs(flight.rise - displayStairway.rise)).toBeLessThan(0.01)
        expect(flight.run).toBeCloseTo(displayStairway.going, 9)
      }
      // The floor behind the door leaves room for the threshold in front of the casing everywhere across the stairway.
      const startZ = flights[0].start[2]
      for (const x of [flights[0].start[0] - displayStairway.width / 2, flights[0].start[0] + displayStairway.width / 2]) {
        const [, worldZ] = frameToWorld([x, startZ])
        expect(worldZ - tunnel.north[1]).toBeGreaterThanOrEqual(wallFace + displayStairway.threshold - 1e-9)
      }
      // the Oculus’ south wall and the stairway’s wall behind it, back to back
      const material = new MeshBasicMaterial
      const doorWalls = wallMeshes([oculusSouth, display.stairway.walls.find(wall => wall.holes?.length)!], material)
      try {
        for (const offset of [-0.6, 0, 0.6]) {
          for (const height of [0.1, 1.6, displayStairway.doorHeight - 0.1]) {
            const ray = new Raycaster(new Vector3(door[0] + offset, balconyY + height, door[2] - 0.5), new Vector3(0, 0, 1), 0, 1)
            expect(ray.intersectObjects(doorWalls.meshes)).toHaveLength(0)
          }
        }
        for (const [offset, height] of [[0, displayStairway.doorHeight + 0.15], [-1.2, 1.6], [1.2, 1.6]]) {
          const ray = new Raycaster(new Vector3(door[0] + offset, balconyY + height, door[2] - 0.5), new Vector3(0, 0, 1), 0, 1)
          expect(ray.intersectObjects(doorWalls.meshes).length).toBeGreaterThan(0)
        }
      } finally {
        doorWalls.dispose()
        material.dispose()
      }
      const positions: Array<[Vec3, number]> = [
        ...display.stairway.treads.map((block): [Vec3, number] => [fromFrame([block.position[0], block.top + 1.6, block.position[2]]), block.top]),
        ...[entry, middle, landing].map(({polygon, floor}): [Vec3, number] => [fromFrame([polygonCentroid(polygon)[0], floor + 1.6, polygonCentroid(polygon)[1]]), floor]),
      ]
      for (const [position, floor] of positions) {
        expect(insideGallery(position)).toBe(true)
        expect(roomAt(position)).toBe('exhibition')
        expect(floorHeight(position)).toBeCloseTo(floor)
      }
    })
    test(`${display.side}: the cutout in the display’s south end wall opens onto the landing up to the display’s ceiling`, () => {
      const material = new MeshBasicMaterial
      const shell = shellGeometries(display).map(geometry => new Mesh(geometry, material))
      const landingWalls = wallMeshes(display.stairway.walls.filter(wall => wall.id.includes('landing')), material)
      const meshes = [...shell, ...landingWalls.meshes]
      const {southZ, cutoutX} = places(display)
      const alongWorld = directionFromFrame([0, 0, 1])
      const acrossWorld = directionFromFrame([1, 0, 0])
      const cast = (x: number, height: number) => {
        const ray = new Raycaster(new Vector3(...fromFrame([x, tunnelSlopeHeight(southZ) + height, southZ - 0.5])), alongWorld, 0, 1.5)
        return ray.intersectObjects(meshes)
      }
      try {
        // The landing’s ceiling meets the display’s, which reaches over the south end wall.
        expect(cutout.top).toBeGreaterThan(tunnelSlopeHeight(southZ) + tunnel.height)
        for (const x of [cutout.from + sign * 0.1, cutoutX, cutout.to - sign * 0.1]) {
          for (const height of [0.1, 1.6, tunnel.height - 0.15]) {
            expect(cast(x, height)).toHaveLength(0)
          }
          const up = new Raycaster(new Vector3(...fromFrame([x, landing.floor + 1.6, southZ + 0.09])), new Vector3(0, 1, 0), 0, tunnel.height)
          expect(up.intersectObjects(meshes)[0]?.point.y).toBeCloseTo(tunnelSlopeHeight(southZ + 0.09) + tunnel.height, 3)
        }
        expect(cast(cutout.from - sign * 0.05, 1.6).length).toBeGreaterThan(0)
        // The display’s back wall reaches on past the south end wall as the cutout’s other jamb.
        const jamb = new Raycaster(new Vector3(...fromFrame([cutoutX, landing.floor + 1.6, southZ + 0.05])), acrossWorld.clone().multiplyScalar(sign), 0, displayStairway.cutoutWidth)
        expect(jamb.intersectObjects(meshes)[0]?.distance).toBeCloseTo(displayStairway.cutoutWidth / 2)
      } finally {
        for (const mesh of shell) {
          mesh.geometry.dispose()
        }
        landingWalls.dispose()
        material.dispose()
      }
    })
    for (const returning of [false, true]) {
      test(`${display.side}: the player walks ${returning ? 'up from the display to the balcony' : 'down from the balcony into the display'}`, () => {
        const world = stairwayWorld(display)
        const place = places(display)
        const path: Array<Point> = [[door[0], door[2] - 1.2], [door[0], door[2] + 0.6], place.entry, place.upperTop, place.middle, place.lowerFoot, place.landing, place.cutout, place.inside, place.center]
        if (returning) {
          path.reverse()
        }
        const [start] = path
        const startY = returning ? tunnelSlopeHeight(worldToFrame(start)[1]) : balconyY
        try {
          const end = walk(world, [start[0], startY + 0.04, start[1]], path.slice(1), {
            each: ([x, y, z]) => {
              if (!insideGallery([x, y + 1.6, z])) {
                throw new Error(`outside the gallery at ${x}, ${y}, ${z}`)
              }
              // The balcony is the Oculus’, the stairway behind its door and the display the Exhibition’s.
              expect(roomAt([x, y + 1.6, z])).toBe(z < tunnel.north[1] ? 'oculus' : 'exhibition')
            },
          })
          const last = path.at(-1)!
          expect(end[1]).toBeCloseTo((returning ? balconyY : tunnelSlopeHeight(worldToFrame(last)[1])) + 0.02, 1)
          expect(end.grounded).toBe(true)
        } finally {
          world.free()
        }
      })
    }
    test(`${display.side}: the window is a real opening with glass collision, solid sills and a closed display shell`, () => {
      const wall = walls.find(value => value.id === `exhibition-${display.side}`)!
      const window = wall.holes!.find(hole => hole.name === 'display')!
      expect(window.bottom).toBe(tunnelDisplayWindow.bottom)
      expect(window.height).toBe(tunnelDisplayWindow.top)
      expect(window.width).toBeCloseTo(display.window[1] - display.window[0], 9)
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
        for (const share of [-0.48, -0.25, 0, 0.25, 0.48]) {
          const u = window.u + share * window.width
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
        for (const [u, y] of [[window.u, 0.3], [window.u, 3], [window.u - window.width / 2 - 0.2, 1.6], [window.u + window.width / 2 + 0.2, 1.6]]) {
          const surroundRay = new Raycaster(new Vector3(u, y + u * wall.slope!, 1), new Vector3(0, 0, -1), 0, 2)
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
      const geometries = shellGeometries(display)
      try {
        addGeometries(shell, geometries)
        shell.step()
        // beside the cutout in the south end wall
        const origin = new Vector3(...fromFrame([display.frontX + sign * 0.45, tunnelSlopeHeight(display.center[1]) + 1.6, display.center[1]]))
        const across = directionFromFrame([1, 0, 0])
        const along = directionFromFrame([0, 0, 1])
        for (const direction of [across.clone().multiplyScalar(sign), new Vector3(0, 1, 0), new Vector3(0, -1, 0), along, along.clone().negate()]) {
          expect(shell.castRay(new RAPIER.Ray(origin, direction), 20, true)).not.toBeNull()
        }
      } finally {
        shell.free()
        for (const part of geometries) {
          part.dispose()
        }
      }
    })
    test(`${display.side}: glass blocks artwork placement through the display window`, () => {
      const z = display.center[1]
      const [x, worldZ] = frameToWorld([0, z])
      const [ox, oz] = frameToWorld([0, 0])
      const [ax, az] = frameToWorld([sign, 0])
      const hit = galleryPlacement.findPlacement([x, tunnelSlopeHeight(z) + 1.6, worldZ], [ax - ox, 0, az - oz], 1, 1, [])
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
          addWalls(world, [walls.find(value => value.id === `exhibition-${display.side}`)!])
          const slabs = tunnelSlabGeometries()
          addGeometries(world, slabs)
          const z = display.center[1]
          const [x, worldZ] = frameToWorld([0, z])
          const [ox, oz] = frameToWorld([0, 0])
          const [ax, az] = frameToWorld([sign, 0])
          const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, tunnelSlopeHeight(z) + 0.04, worldZ))
          const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
          const motor = new EgoMotor(RAPIER, world, body, collider)
          // facing straight at the window
          const facing = new Quaternion
          facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-(ax - ox), -(az - oz)))
          try {
            for (let i = 0; i < fps * 3; i++) {
              motor.step(world.timestep, {
                forward: true,
                sprint: true,
                jump: jump && i === fps,
              }, facing)
              world.step()
            }
            const {x: endX, y: endY, z: endZ} = body.translation()
            const [across] = worldToFrame([endX, endZ])
            expect(Math.abs(across)).toBeLessThan(half - 0.25)
            expect(Math.abs(across)).toBeGreaterThan(1)
            expect(insideGallery([endX, endY, endZ])).toBe(true)
          } finally {
            motor.dispose()
            world.free()
            for (const slab of slabs) {
              slab.dispose()
            }
          }
        })
      }
    }
  }
})
