import {afterAll, describe, expect, test} from 'bun:test'

import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {BufferAttribute, BufferGeometry, DoubleSide, Frustum, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architecture.ts'
import CrumbledStoneGeometry from '../../src/lib/gallery/CrumbledStoneGeometry.ts'
import {roomFloorPlan} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {salonWindow} from '../../src/lib/gallery/lobbyWindows.ts'
import {portals, visibleRooms} from '../../src/lib/gallery/roomVisibility.ts'
import {salonBench, salonCeiling, salonSculptureSocket, salonTerrazzo, salonWainscot, wainscotFields, wallDressingSpans} from '../../src/lib/gallery/salon.ts'
import salonLantern, {domeSection, octagon, salonDomeEyeY, salonDomeSpringY, salonDrumOuterApothem, salonLanternBase, salonLanternTopY, salonWindowSpringY} from '../../src/lib/gallery/salonLantern.ts'
import SalonLanternGeometry, {salonLanternCollision, salonSailLength, shellCourses} from '../../src/lib/gallery/SalonLanternGeometry.ts'
import {middaySun} from '../../src/lib/gallery/sun.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {shellAttributes} from '../../src/lib/materials/ShellInlayMaterial.ts'
import TerrazzoFloorMaterial, {blackTerrazzo, venetianTerrazzo} from '../../src/lib/materials/TerrazzoFloorMaterial.ts'
import {insideOpening, placementIssue, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls, {floorHeight, insideGallery, roomAt, roomClearHeight, rooms} from './fixtures/gallery.ts'

const room = rooms.find(candidate => candidate.id === 'salon')!
const lantern = new SalonLanternGeometry(room.size)
const doubleSided = new MeshBasicMaterial({side: DoubleSide})
afterAll(() => {
  lantern.dispose()
  doubleSided.dispose()
})
/** the parts of the lantern as meshes in the room’s frame, ready for fast raycasts */
const lanternMeshes = (parts: ReadonlyArray<typeof lantern.stucco>) => parts.map(part => {
  const mesh = new Mesh(part, doubleSided)
  part.boundsTree ??= new MeshBVH(part)
  mesh.raycast = acceleratedRaycast
  mesh.updateMatrixWorld()
  return mesh
})
const opaque = lanternMeshes([lantern.stucco, lantern.sails, lantern.gilt, lantern.bronze])
const glazing = lanternMeshes([lantern.windowGlass, lantern.lanternGlass])
const [faceX, faceZ] = room.size.map(size => size / 2 - wallFace)
/** Where a ray of the midday sun from the point on the floor, in the room’s frame, leaves the room: through the glass, or into the ceiling, or nowhere for a ray that leaves through the walls below it. */
const sunlight = (x: number, z: number) => {
  const origin = new Vector3(x, 0.1, z)
  const direction = new Vector3(...middaySun)
  const ceiling = origin.clone().addScaledVector(direction, (salonLanternBase - origin.y) / direction.y)
  if (Math.abs(ceiling.x) > faceX || Math.abs(ceiling.z) > faceZ) {
    return
  }
  const raycaster = new Raycaster(origin, direction)
  const blocked = raycaster.intersectObjects(opaque, false).at(0)
  const pane = raycaster.intersectObjects(glazing, false).toSorted((a, b) => a.distance - b.distance).at(0)
  if (pane && (!blocked || blocked.distance > pane.distance)) {
    return pane.object === glazing[1] ? 'lantern' : 'window'
  }
  return blocked ? 'shade' : 'open'
}
/** the points on the floor, in the room’s frame, that the sun reaches through the windows or through the lantern */
const sunlitBy = (kind: 'lantern' | 'window') => {
  const points: Array<readonly [number, number]> = []
  for (let x = -5.8; x <= 5.8; x += 0.1) {
    for (let z = -7.8; z <= 7.8; z += 0.1) {
      if (sunlight(x, z) === kind) {
        points.push([x, z])
      }
    }
  }
  return points
}
const pointKey = (vector: Vector3) => [vector.x, vector.y, vector.z].map(value => Math.round(value * 1e5)).join(':')
const vertex = (attribute: ReturnType<typeof lantern.stucco.getAttribute>, index: number) => {
  const point = new Vector3
  return point.fromBufferAttribute(attribute, index)
}
const view = (position: Vector3, target: Vector3) => {
  const camera = new PerspectiveCamera(70, 16 / 9, 0.05, 90)
  camera.position.copy(position)
  camera.lookAt(target)
  camera.updateMatrixWorld()
  const frustum = new Frustum
  const viewProjection = new Matrix4
  return frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
}
describe('the Salon', () => {
  test('sits north of the Banquet on the upper floor, beside the Lobby extension and above no lower room', () => {
    const banquet = rooms.find(candidate => candidate.id === 'banquet')!
    expect(room.floorY).toBe(0)
    expect(room.center[0]).toBe(banquet.center[0])
    expect(room.center[1] + room.size[1] / 2).toBe(banquet.center[1] - banquet.size[1] / 2)
    expect(room.center[0] - room.size[0] / 2).toBe(lobby.width / 2)
    const upper = rooms.filter(candidate => candidate.floorY === 0 && candidate.id !== 'salon')
    for (const other of upper) {
      const overlapX = Math.min(room.center[0] + room.size[0] / 2, other.center[0] + other.size[0] / 2) - Math.max(room.center[0] - room.size[0] / 2, other.center[0] - other.size[0] / 2)
      const overlapZ = Math.min(room.center[1] + room.size[1] / 2, other.center[1] + other.size[1] / 2) - Math.max(room.center[1] - room.size[1] / 2, other.center[1] - other.size[1] / 2)
      expect(Math.min(overlapX, overlapZ)).toBeLessThanOrEqual(0)
    }
    for (const [x, z] of [[8.5, -19.5], [19.5, -16.5], [14, -24], [8.5, -31.5], [19.5, -31.5]]) {
      expect(roomAt([x, 1.7, z])).toBe('salon')
      expect(floorHeight([x, 1.7, z])).toBe(0)
    }
    expect(insideGallery([20.5, 1.7, -14])).toBe(false)
    expect(insideGallery([14, 1.7, -32.5])).toBe(false)
  })
  test('one shared arch joins the Banquet and the Salon, back to back on the same plane', () => {
    const banquetNorth = walls.find(wall => wall.id === 'banquet-north')!
    const salonSouth = walls.find(wall => wall.id === 'salon-south')!
    expect(banquetNorth.center).toEqual(salonSouth.center)
    expect(Math.abs(Math.cos(banquetNorth.rotation - salonSouth.rotation) + 1)).toBeLessThan(1e-12)
    expect(placementIssue(banquetNorth, wallPosition(banquetNorth, 0, 2.6), 1, 1, [])).toBe('doorway')
    const doorway = [14, 1.7, -16] as const
    for (const wall of [banquetNorth, salonSouth]) {
      expect(wall.holes).toHaveLength(1)
      expect(insideOpening(wall.holes![0], wallCoordinates(wall, [...doorway]), 1.7)).toBe(true)
    }
    expect(roomAt([14, 1.7, -15.9])).toBe('banquet')
    expect(roomAt([14, 1.7, -16.1])).toBe('salon')
    // Its west wall backs the Lobby extension the same way.
    const salonWest = walls.find(wall => wall.id === 'salon-west')!
    const lobbyEast = walls.find(wall => wall.id === 'lobby-extension_east')!
    expect(salonWest.center[0]).toBe(lobbyEast.center[0])
    expect(Math.abs(Math.cos(salonWest.rotation - lobbyEast.rotation) + 1)).toBeLessThan(1e-12)
  })
  test('the ottoman’s south edge aligns with the glass wall’s south end, leaving the doorway path and walls clear', () => {
    const {depth, position, width} = salonBench
    expect(position[0]).toBe(room.center[0])
    expect(position[1]).toBe(room.floorY)
    expect(position[2] + depth / 2).toBeCloseTo(salonWindow.z + salonWindow.width / 2, 9)
    expect(room.center[1] + room.size[1] / 2 - (position[2] + depth / 2)).toBeGreaterThan(3)
    expect(Math.abs(position[0] - room.center[0]) + width / 2).toBeLessThan(room.size[0] / 2 - 3)
    // a seat at the height of a chair’s
    expect(salonBench.seatHeight).toBeGreaterThan(0.4)
    expect(salonBench.seatHeight).toBeLessThan(0.55)
  })
  test('the sculpture socket sits inside the glass wall’s north end and keeps a flat working face inside its chipped edges', () => {
    const {position: [x, y, z], size} = salonSculptureSocket
    const [width, height, depth] = size
    expect([width, depth]).toEqual([salonBench.width, salonBench.width])
    expect(z - depth / 2).toBeCloseTo(salonWindow.z - salonWindow.width / 2, 9)
    expect(z + depth / 2).toBeLessThan(salonBench.position[2] - salonBench.depth / 2)
    const geometry = new CrumbledStoneGeometry(size)
    const material = new MeshBasicMaterial
    try {
      const socket = new Mesh(geometry, material)
      socket.position.set(x, y + height / 2, z)
      socket.updateMatrixWorld()
      expect(y).toBe(floorHeight([x, 1.7, z]))
      const above = (dx: number, dz: number) => {
        const ray = new Raycaster(new Vector3(x + dx, y + 1, z + dz), new Vector3(0, -1, 0))
        return ray.intersectObject(socket).at(0)
      }
      for (const dx of [-width / 3, 0, width / 3]) {
        for (const dz of [-depth / 3, 0, depth / 3]) {
          expect(above(dx, dz)?.point.y).toBeCloseTo(y + height, 6)
        }
      }
      expect(above(width / 2 - 0.001, depth / 2 - 0.001)?.point.y ?? y).toBeLessThan(y + height / 2)
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
  test('the lantern rises from the ceiling over the room’s middle, clear of the walls, and the room’s air reaches its finial', () => {
    const corners = octagon(salonDrumOuterApothem + 0.1)
    for (const [x, z] of corners) {
      expect(Math.abs(x)).toBeLessThan(faceX - 1)
      expect(Math.abs(z)).toBeLessThan(faceZ - 1)
    }
    expect(salonLanternBase).toBe(salonCeiling.underside)
    expect(salonLantern.window.sill).toBeGreaterThan(salonCeiling.y + salonCeiling.thickness / 2)
    expect(salonWindowSpringY).toBeGreaterThan(salonLantern.window.sill)
    expect(salonLantern.window.crown).toBeCloseTo(salonWindowSpringY + salonLantern.window.width / 2, 9)
    // The architrave round every window’s head stays clear of the cornice under the dome.
    expect(salonLantern.window.crown + salonLantern.architrave[0]).toBeLessThan(salonDomeSpringY - salonLantern.cornice[0][0] - salonLantern.cornice[1][0])
    expect(domeSection(0)).toEqual([salonLantern.apothem, salonDomeSpringY])
    expect(domeSection(Math.PI / 2)[1]).toBeCloseTo(salonDomeEyeY, 9)
    expect(roomClearHeight(room)).toBeCloseTo(salonLanternTopY, 9)
    expect(roomAt([room.center[0], salonDomeEyeY - 0.3, room.center[1]])).toBe('salon')
    for (const part of [lantern.stucco, lantern.sails, lantern.gilt, lantern.bronze, lantern.windowGlass, lantern.lanternGlass]) {
      part.computeBoundingBox()
      const {min, max} = part.boundingBox!
      expect(Math.max(-min.x, max.x)).toBeLessThanOrEqual(room.size[0] / 2 + 1e-6)
      expect(Math.max(-min.z, max.z)).toBeLessThanOrEqual(room.size[1] / 2 + 1e-6)
      expect(min.y).toBeGreaterThan(5.5)
      expect(max.y).toBeLessThanOrEqual(salonLanternTopY + 1e-6)
    }
  })
  test('the stucco and the sails close up into solids, touching but never open, and face out of them', () => {
    const edges = new Map<string, number>
    for (const part of [lantern.stucco, lantern.sails]) {
      const position = part.getAttribute('position')
      const normal = part.getAttribute('normal')
      const triangles = part.index!
      for (let index = 0; index < triangles.count; index += 3) {
        const ids = [0, 1, 2].map(corner => triangles.getX(index + corner))
        const [a, b, c] = ids.map(id => vertex(position, id))
        const face = b.clone().sub(a).cross(c.clone().sub(a))
        expect(face.length()).toBeGreaterThan(1e-10)
        const shading = ids.reduce((sum, id) => sum.add(vertex(normal, id)), new Vector3).normalize()
        expect(face.normalize().dot(shading)).toBeGreaterThan(0.5)
        for (const [from, to] of [[a, b], [b, c], [c, a]]) {
          const edge = [pointKey(from), pointKey(to)].toSorted().join('/')
          edges.set(edge, (edges.get(edge) ?? 0) + 1)
        }
      }
    }
    // Solids that touch share edges, but an edge on the border of an opening would show up once, or three times.
    expect(edges.values().filter(count => count % 2 === 1).toArray()).toEqual([])
  })
  test('lets the sun in through the drum’s southern windows and the lantern, in patches crossed by their bars, and nowhere else', () => {
    const counts = {
      lantern: 0,
      open: 0,
      shade: 0,
      window: 0,
    }
    let total = 0
    for (let x = -5.8; x <= 5.8; x += 0.1) {
      for (let z = -7.8; z <= 7.8; z += 0.1) {
        const result = sunlight(x, z)
        if (!result) {
          continue
        }
        counts[result]++
        total++
      }
    }
    expect(total).toBeGreaterThan(5000)
    // Nothing reaches the floor through a gap.
    expect(counts.open).toBe(0)
    expect(counts.window / total).toBeGreaterThan(0.02)
    expect(counts.window / total).toBeLessThan(0.2)
    // Most of the lantern’s beam lands on the north wall’s socle, the rest on the floor in front of it.
    expect(counts.lantern).toBeGreaterThan(10)
    // The arched patches of the windows on the sunny side fall north of the room’s middle, and the lantern’s farther north, by the north wall.
    const windows = sunlitBy('window')
    expect(windows.every(([, z]) => z < 0)).toBe(true)
    const sides = new Set(windows.map(([x]) => Math.sign(Math.round(x))))
    expect(sides.size).toBe(3)
    for (const [, z] of sunlitBy('lantern')) {
      expect(z).toBeLessThan(-4)
      expect(z).toBeGreaterThan(-faceZ)
    }
  })
  test('the sails hold courses of whole shells between the creases, each about as wide as the next, half as high as wide', () => {
    const courses = shellCourses()
    expect(courses.length).toBeGreaterThan(20)
    const {course, margins, width} = salonLantern.shells
    for (const [index, shells] of courses.entries()) {
      expect(Number.isInteger(shells.count)).toBe(true)
      expect(shells.count).toBeGreaterThan(0)
      expect(shells.width).toBeGreaterThan(width * 0.75)
      expect(shells.width).toBeLessThan(width * 1.25)
      expect(shells.height).toBeCloseTo(shells.width * course, 9)
      expect(shells.stagger).toBe(index % 2 === 1)
      if (index === 0) {
        continue
      }
      const previous = courses[index - 1]
      expect(shells.start).toBeCloseTo(previous.start + previous.height, 9)
      expect(shells.count).toBeLessThanOrEqual(previous.count)
    }
    expect(courses[0].start).toBe(margins.foot)
    expect(courses.at(-1)!.start + courses.at(-1)!.height).toBeLessThanOrEqual(salonSailLength - margins.eye)
    // The sails carry their layout to the shader on every vertex.
    const layout = lantern.sails.getAttribute(shellAttributes.course)
    const sail = lantern.sails.getAttribute(shellAttributes.sail)
    const uv = lantern.sails.getAttribute('uv')
    expect(layout.count).toBe(uv.count)
    for (let index = 0; index < uv.count; index++) {
      expect(Math.abs(uv.getX(index))).toBeCloseTo(sail.getZ(index), 5)
      if (!(layout.getW(index) > 0)) {
        continue
      }
      expect(uv.getY(index)).toBeGreaterThanOrEqual(layout.getX(index) - 1e-5)
      expect(uv.getY(index)).toBeLessThanOrEqual(layout.getX(index) + layout.getY(index) + 1e-5)
      // Every shell fits between the creases, measured across its course’s middle, where its margins along them are as wide as they should be.
      expect(layout.getZ(index) * layout.getW(index) / 2).toBeLessThanOrEqual(sail.getZ(index) - margins.ribs / 2)
    }
  })
  test('keeps a modest triangle budget', () => {
    const parts = [lantern.stucco, lantern.sails, lantern.gilt, lantern.bronze, lantern.windowGlass, lantern.lanternGlass]
    expect(parts.reduce((sum, part) => sum + triangleCount(part), 0)).toBeLessThan(25_000)
  })
  test('a smooth collision surface lines the ceiling, the drum, the dome and the lantern', () => {
    const [positions, indices] = salonLanternCollision(room.size)
    expect(indices.length % 3).toBe(0)
    expect(indices.length).toBeGreaterThan(0)
    for (let index = 0; index < positions.length; index += 3) {
      expect(Math.abs(positions[index])).toBeLessThanOrEqual(faceX + 1e-5)
      expect(positions[index + 1]).toBeGreaterThanOrEqual(salonLanternBase - 1e-5)
      expect(Math.abs(positions[index + 2])).toBeLessThanOrEqual(faceZ + 1e-5)
    }
    // Something thrown straight up anywhere in the room meets it, under the ceiling or the dome.
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setIndex(new BufferAttribute(indices, 1))
    const surface = new Mesh(geometry, doubleSided)
    try {
      for (let x = -faceX + 0.2; x < faceX; x += 0.5) {
        for (let z = -faceZ + 0.2; z < faceZ; z += 0.5) {
          const raycaster = new Raycaster(new Vector3(x, 2, z), new Vector3(0, 1, 0))
          const hit = raycaster.intersectObject(surface).at(0)
          expect(hit).toBeDefined()
          expect(hit!.point.y).toBeLessThan(salonLanternTopY)
        }
      }
    } finally {
      geometry.dispose()
    }
  })
  test('the drum’s windows show the Lobby’s vault rising next door', () => {
    expect(portals.some(portal => portal.rooms.includes('salon') && portal.rooms.includes('lobby') && portal.box.min.y > salonCeiling.y)).toBe(true)
    // Looking up at the drum’s west windows from under its eastern side, with the glass wall to the Lobby below the view.
    const eye = new Vector3(room.center[0] + 2.5, 1.6, room.center[1])
    expect(visibleRooms('salon', view(eye, new Vector3(room.center[0] - salonLantern.apothem, 7, room.center[1]))).has('lobby')).toBe(true)
  })
  test('wainscot runs stop at the arch trim and fit between the corners', () => {
    const south = walls.find(wall => wall.id === 'salon-south')!
    const spans = wallDressingSpans(south, 0.17, wallFace)
    expect(spans).toHaveLength(2)
    expect(spans[0][0]).toBeCloseTo(-south.width / 2 + wallFace)
    expect(spans[0][1]).toBeCloseTo(-1.4 - 0.17)
    expect(spans[1][0]).toBeCloseTo(1.4 + 0.17)
    const north = walls.find(wall => wall.id === 'salon-north')!
    expect(wallDressingSpans(north, 0.17, wallFace)).toEqual([[-north.width / 2 + wallFace, north.width / 2 - wallFace]])
    for (const [start, end] of [...spans, [-6, 6] as const]) {
      const fields = wainscotFields(start, end)
      expect(fields.length).toBeGreaterThan(0)
      for (const [center, width] of fields) {
        expect(center - width / 2).toBeGreaterThanOrEqual(start + salonWainscot.margin - 1e-9)
        expect(center + width / 2).toBeLessThanOrEqual(end - salonWainscot.margin + 1e-9)
      }
    }
  })
  test('its polished terrazzo mirrors the room, its border on the brass inlays’ line', () => {
    const polished = new TerrazzoFloorMaterial({
      center: room.center,
      size: room.size,
      field: venetianTerrazzo,
      border: blackTerrazzo,
      inset: salonTerrazzo.border,
      reflections: true,
      ...salonTerrazzo.polish,
    })
    try {
      expect(polished.reflection).not.toBeNull()
      expect(polished.reflectionTarget).not.toBeNull()
      expect(polished.mirrored.value).toBe(1)
    } finally {
      polished.dispose()
    }
    for (const shape of [{size: [0, 1] as const}, {radius: 0}]) {
      expect(() => new TerrazzoFloorMaterial({
        center: [0, 0],
        ...shape,
        field: venetianTerrazzo,
      })).toThrow(RangeError)
    }
    // The border reaches in as far as the brass inlays, which every stone floor lays at the same distance from its walls.
    const inlays = roomFloorPlan(room).inlays.filter(inlay => inlay.size[1] > inlay.size[0])
    expect(inlays.length).toBeGreaterThan(0)
    for (const inlay of inlays) {
      expect(room.size[0] / 2 - Math.abs(inlay.center[0])).toBeCloseTo(salonTerrazzo.border, 6)
    }
  })
})
