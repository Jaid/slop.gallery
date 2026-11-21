import type {FloorRectangle} from '../../src/lib/gallery/floors.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {corridorPassage} from '../../src/lib/gallery/corridor.ts'
import {polygonArea, polygonBounds, quadrilaterals, slabHullReach, slabHulls} from '../../src/lib/gallery/floorPolygons.ts'
import {floorGlassThickness, roomFloorPlan, subtractFloorOpening} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import walls, {rooms} from './fixtures/gallery.ts'

await RAPIER.init()
const room = rooms.find(value => value.id === 'lobby')!
const plan = roomFloorPlan(room)
const area = (rectangles: Array<FloorRectangle>) => rectangles.reduce((sum, rectangle) => sum + rectangle.size[0] * rectangle.size[1], 0)
const openingWest = lobby.opening.center[0] - lobby.opening.size[0] / 2
const openingEast = lobby.opening.center[0] + lobby.opening.size[0] / 2
const openingNorth = lobby.opening.center[1] - lobby.opening.size[1] / 2
const openingSouth = lobby.opening.center[1] + lobby.opening.size[1] / 2
/** coordinates around both edges of the opening along an axis, a centimeter to either side, on them and further out */
const across = (low: number, high: number) => [low - 3, low - 0.01, low, low + 0.01, (low + high) / 2, high - 0.01, high, high + 0.01, high + 3]
describe('rectangular floor openings', () => {
  test('handles disjoint, touching, covering and partial cuts without degenerate rectangles', () => {
    const rectangle: FloorRectangle = {
      center: [0, 0],
      size: [10, 10],
    }
    expect(subtractFloorOpening(rectangle)).toEqual([rectangle])
    expect(subtractFloorOpening(rectangle, {
      center: [12, 0],
      size: [2, 2],
    })).toEqual([rectangle])
    expect(subtractFloorOpening(rectangle, {
      center: [6, 0],
      size: [2, 2],
    })).toEqual([rectangle])
    expect(subtractFloorOpening(rectangle, rectangle)).toEqual([])
    expect(subtractFloorOpening(rectangle, {
      center: [0, 0],
      size: [20, 20],
    })).toEqual([])
    expect(area(subtractFloorOpening(rectangle, {
      center: [5, 0],
      size: [4, 4],
    }))).toBe(92)
    expect(area(subtractFloorOpening(rectangle, {
      center: [0, 0],
      size: [2, 20],
    }))).toBe(80)
  })
  test('reserves a square in the north extension, as far from the north wall as from the side walls, and glazes it', () => {
    const [openingWidth, openingDepth] = lobby.opening.size
    expect(openingWidth).toBe(openingDepth)
    expect(room.center[0]).toBe(lobby.opening.center[0])
    expect(openingSouth).toBeLessThan(lobby.previousNorthZ)
    expect(openingNorth - lobby.northZ).toBe((lobby.width - openingWidth) / 2)
    expect(area(plan.slabs)).toBe(room.size[0] * room.size[1] - openingWidth * openingDepth)
    expect(plan.slabs).toHaveLength(4)
    expect(plan.glazing).toEqual({
      center: [lobby.opening.center[0] - room.center[0], lobby.opening.center[1] - room.center[1]],
      size: lobby.opening.size,
    })
    for (const side of ['west', 'east']) {
      const extension = walls.find(wall => wall.id === `lobby-extension_${side}`)!
      expect(extension.center[2] - extension.width / 2).toBe(lobby.northZ)
      expect(extension.center[2] + extension.width / 2).toBe(lobby.previousNorthZ)
    }
  })
  test('slabs, grout and inlays are all absent over the opening', () => {
    const opening: FloorRectangle = {
      center: [lobby.opening.center[0] - room.center[0], lobby.opening.center[1] - room.center[1]],
      size: lobby.opening.size,
    }
    for (const rectangle of [...plan.slabs, ...plan.seams, ...plan.inlays]) {
      expect(subtractFloorOpening(rectangle, opening)).toEqual([rectangle])
      expect(rectangle.size.every(value => value > 0 && Number.isFinite(value))).toBe(true)
    }
    for (const other of rooms) {
      if (other.id === 'lobby') {
        continue
      }
      expect(roomFloorPlan(other).glazing).toBeUndefined()
      expect(roomFloorPlan(other).slabs).toEqual([
        {
          center: [0, 0],
          size: other.size,
        },
      ])
    }
  })
  test('slabs leave a real cutout and flush glazing supports the opening and its seams', () => {
    const material = new MeshBasicMaterial
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    const meshes = plan.slabs.map(({center: [x, z], size: [width, depth]}) => {
      const mesh = new Mesh(new BoxGeometry(width, 0.24, depth), material)
      mesh.position.set(x + room.center[0], -0.12, z + room.center[1])
      mesh.updateMatrixWorld(true)
      world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, 0.12, depth / 2).setTranslation(mesh.position.x, mesh.position.y, mesh.position.z))
      return mesh
    })
    try {
      world.step()
      for (const x of across(openingWest, openingEast)) {
        for (const z of [...across(openingNorth, openingSouth), lobby.previousNorthZ, room.center[1]]) {
          if (x === openingWest || x === openingEast || z === openingNorth || z === openingSouth) {
            continue
          }
          const solid = !(x > openingWest && x < openingEast && z > openingNorth && z < openingSouth)
          const origin = new Vector3(x, 1, z)
          const direction = new Vector3(0, -1, 0)
          const slabRay = new Raycaster(origin, direction, 0, 2)
          expect(slabRay.intersectObjects(meshes).length > 0).toBe(solid)
          expect(!!world.castRay(new RAPIER.Ray(origin, direction), 2, true)).toBe(solid)
        }
      }
      const glazing = plan.glazing!
      const glass = new Mesh(new BoxGeometry(glazing.size[0], floorGlassThickness, glazing.size[1]), material)
      glass.position.set(glazing.center[0] + room.center[0], -floorGlassThickness / 2, glazing.center[1] + room.center[1])
      glass.updateMatrixWorld(true)
      meshes.push(glass)
      world.createCollider(RAPIER.ColliderDesc.cuboid(glazing.size[0] / 2, floorGlassThickness / 2, glazing.size[1] / 2).setTranslation(glass.position.x, glass.position.y, glass.position.z))
      world.step()
      for (const x of across(openingWest, openingEast)) {
        for (const z of across(openingNorth, openingSouth)) {
          const origin = new Vector3(x, 1, z)
          const direction = new Vector3(0, -1, 0)
          const glazedFloorRay = new Raycaster(origin, direction, 0, 2)
          expect(glazedFloorRay.intersectObjects(meshes)[0].point.y).toBeCloseTo(0)
          expect(world.castRay(new RAPIER.Ray(origin, direction), 2, true)!.timeOfImpact).toBeCloseTo(1)
        }
      }
      const supported = [openingWest - 3, openingWest, lobby.opening.center[0], openingEast, openingEast + 3].map(x => {
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1, openingSouth))
        world.createCollider(RAPIER.ColliderDesc.ball(0.25), body)
        return body
      })
      for (let i = 0; i < 120; i++) {
        world.step()
      }
      for (const body of supported) {
        expect(body.translation().y).toBeCloseTo(0.25, 2)
      }
    } finally {
      for (const mesh of meshes) {
        mesh.geometry.dispose()
      }
      material.dispose()
      world.free()
    }
  })
})
/** a regular polygon with 3 m to its corners */
const regular = (corners: number) => Array.from({length: corners}, (_, i) => [3 * Math.cos(i / corners * 2 * Math.PI), 3 * Math.sin(i / corners * 2 * Math.PI)] as const)
/** the corners on the ground of a slab’s hull */
const footprint = (corners: Float32Array) => Array.from({length: corners.length / 6}, (_, i) => [corners[i * 6], corners[i * 6 + 2]] as const)
describe('convex floor slabs', () => {
  test('split into convex pieces of at most four corners that cover the polygon', () => {
    for (let corners = 3; corners <= 9; corners++) {
      const polygon = regular(corners)
      const pieces = quadrilaterals(polygon)
      expect(pieces).toHaveLength(Math.ceil((corners - 2) / 2))
      for (const piece of pieces) {
        expect(piece.length).toBeGreaterThanOrEqual(3)
        expect(piece.length).toBeLessThanOrEqual(4)
        expect(piece.every(corner => polygon.includes(corner))).toBe(true)
      }
      expect(pieces.reduce((sum, piece) => sum + polygonArea(piece), 0)).toBeCloseTo(polygonArea(polygon))
    }
  })
  test('cut along their shortest diagonals', () => {
    // A square with a trapezoid on its north side splits along the square’s north edge, not across the square.
    const pieces = quadrilaterals([[-5, 5], [-5, -5], [-2, -8], [2, -8], [5, -5], [5, 5]])
    const [trapezoid, square] = pieces.map(piece => polygonArea(piece)).toSorted((a, b) => a - b)
    expect(trapezoid).toBeCloseTo(21)
    expect(square).toBeCloseTo(100)
  })
  // The player’s capsule sank into a single hull over all of the Corridor’s long hall.
  test('cut long polygons across into hulls of a bounded reach that still cover them', () => {
    // the Corridor’s long hall, an askew strip and a polygon small enough to stay whole
    for (const polygon of [corridorPassage.floors.find(floor => polygonBounds(floor).size[1] > slabHullReach)!, [[0, 0], [40, 30], [37, 34], [-3, 4]], regular(8)] as const) {
      const hulls = slabHulls(polygon, -0.24, 0).map(footprint)
      const {size} = polygonBounds(polygon)
      expect(hulls.length).toBeGreaterThanOrEqual(Math.ceil(Math.max(...size) / slabHullReach))
      for (const hull of hulls) {
        expect(hull.length).toBeGreaterThanOrEqual(3)
        expect(hull.length).toBeLessThanOrEqual(4)
        expect(Math.max(...polygonBounds(hull).size)).toBeLessThanOrEqual(slabHullReach + 1e-6)
      }
      expect(hulls.reduce((sum, hull) => sum + polygonArea(hull), 0)).toBeCloseTo(polygonArea(polygon), 4)
    }
  })
  // Rapier builds a box’s contacts with a hull’s face out of at most four of its corners, so boxes sank into slabs with more.
  test('hold boxes up on every part of their surface', () => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    world.integrationParameters.normalizedAllowedLinearError = 0.001
    world.integrationParameters.normalizedPredictionDistance = 0.002
    for (const corners of slabHulls(regular(8), -0.3, 0)) {
      world.createCollider(RAPIER.ColliderDesc.convexHull(corners)!)
    }
    const boxes: Array<RAPIER.RigidBody> = []
    for (let x = -2; x <= 2; x += 0.5) {
      for (let z = -2; z <= 2; z += 0.5) {
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.3, z))
        world.createCollider(RAPIER.ColliderDesc.cuboid(0.1, 0.05, 0.1), body)
        boxes.push(body)
      }
    }
    try {
      for (let i = 0; i < 120; i++) {
        world.step()
      }
      for (const body of boxes) {
        expect(body.translation().y).toBeCloseTo(0.05, 2)
      }
    } finally {
      world.free()
    }
  })
})
