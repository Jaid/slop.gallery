import type {Wall} from '../../src/lib/placement/wallGeometry.ts'
import type {BufferGeometry} from 'three/webgpu'

import {afterAll, describe, expect, test} from 'bun:test'

import {DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {defaultBaseboardHeight} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionMouth, lodgeSpurWidth, lodgeSpurX} from '../../src/lib/gallery/bastion.ts'
import {lodgeSpur} from '../../src/lib/gallery/bastionNetwork.ts'
import miterCorners from '../../src/lib/gallery/cornerMiters.ts'
import corridor, {corridorLanding, corridorPassage} from '../../src/lib/gallery/corridor.ts'
import {insidePolygon, polygonArea} from '../../src/lib/gallery/floorPolygons.ts'
import lodge, {lodgeEastWindow} from '../../src/lib/gallery/lodge.ts'
import LodgeEastWindowGeometry from '../../src/lib/gallery/LodgeEastWindowGeometry.ts'
import UpholsteredSeatGeometry from '../../src/lib/gallery/lodgeInterior/UpholsteredSeatGeometry.ts'
import Passage from '../../src/lib/gallery/passages/Passage.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import TimberGeometry from '../../src/lib/gallery/passages/TimberGeometry.ts'
import VaultGeometry from '../../src/lib/gallery/passages/VaultGeometry.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import walls from './fixtures/gallery.ts'

const material = new MeshBasicMaterial({side: DoubleSide})
const disposables: Array<{dispose: () => void}> = [material]
afterAll(() => {
  for (const item of disposables) {
    item.dispose()
  }
})
const wallById = (id: string) => walls.find(wall => wall.id === id)!
/** The wall’s architecture as world-space meshes, tagged by part. */
function wallMeshes(wall: Wall) {
  const geometry = createArchitectureGeometry(wall)
  disposables.push(geometry)
  const place = (part: BufferGeometry, name: string) => {
    const mesh = new Mesh(part, material)
    mesh.name = `${wall.id}/${name}`
    mesh.position.set(...wall.center)
    mesh.rotation.y = wall.rotation
    mesh.updateMatrixWorld()
    return mesh
  }
  return [place(geometry.surface, 'surface'), ...geometry.trim.map(part => place(part, 'trim')), ...geometry.cornice.map((part, i) => place(part, `cornice-${i}`))]
}
/** The nearest hits along a ray, keeping every surface that lies at the same distance as the first. */
function nearestHits(meshes: Array<Mesh>, origin: Vector3, direction: Vector3) {
  const raycaster = new Raycaster(origin, direction.normalize())
  const hits = raycaster.intersectObjects(meshes, false)
  expect(hits.length).toBeGreaterThan(0)
  return hits.filter(hit => hit.distance - hits[0].distance < 1e-4)
}
const mitered = (list: ReadonlyArray<Wall>, id: string) => list.find(wall => wall.id === id)?.miters
/** the passage’s walls as bare surfaces */
const passageSurfaces = (passage: Passage) => passage.walls.flatMap(wall => wallMeshes({
  ...wall,
  trimStyle: 'none',
}))
const horizontal = (x: number, z: number) => {
  const direction = new Vector3(x, 0, z)
  return direction.normalize()
}
/** the direction a wall’s face looks into its room */
const inward = (wall: Wall) => horizontal(Math.sin(wall.rotation), Math.cos(wall.rotation))
/** Where the plaster faces of two walls meet, at floor level. */
function facesMeet(a: Wall, b: Wall) {
  const [na, nb] = [inward(a), inward(b)]
  // Each face lies wallFace in front of its wall’s plane through the center.
  const da = wallFace + a.center[0] * na.x + a.center[2] * na.z
  const db = wallFace + b.center[0] * nb.x + b.center[2] * nb.z
  const determinant = na.x * nb.z - na.z * nb.x
  return new Vector3((da * nb.z - db * na.z) / determinant, a.center[1], (na.x * db - nb.x * da) / determinant)
}
/** how far a trim end slants back per meter out of its wall at the bay’s 135° corners */
const bayMiter = Math.SQRT2 - 1
describe('inside corners of room walls', () => {
  test('every room corner miters both walls, on all three levels', () => {
    for (const id of ['lodge-south', 'vesper-north', 'salon-west']) {
      expect(mitered(walls, id)).toEqual([1, 1])
    }
    // The Lodge’s bay turns by 45° at each of its four corners, so its trim ends slant back less than in a right angle.
    for (const [id, miters] of [['lodge-west', [1, bayMiter]], ['lodge-northwest', [bayMiter, bayMiter]], ['lodge-north', [bayMiter, bayMiter]], ['lodge-northeast', [bayMiter, bayMiter]], ['lodge-east', [bayMiter, 1]]] as const) {
      for (const [end, miter] of miters.entries()) {
        expect(mitered(walls, id)![end]).toBeCloseTo(miter, 8)
      }
    }
    // Walls that run on in a straight line, or open into a doorway, keep square ends.
    expect(mitered(walls, 'lobby-west')).toEqual([1, 0])
    expect(mitered(walls, 'lobby-extension_west')).toEqual([0, 1])
    for (const wall of knottingham.walls) {
      expect(wall.miters).toEqual([1, 1])
    }
  })
  test('outside corners and mismatched trim keep square ends', () => {
    const base = {
      room: 'lobby',
      height: 5.5,
      width: 4,
    } as const
    // Two walls meeting at the origin with their faces turned outward, around the corner of a pillar.
    const outside = miterCorners([
      {
        ...base,
        id: 'a',
        center: [2, 0, 0],
        rotation: Math.PI,
      },
      {
        ...base,
        id: 'b',
        center: [0, 0, 2],
        rotation: -Math.PI / 2,
      },
    ])
    expect(outside.map(wall => wall.miters)).toEqual([undefined, undefined])
    const inside = miterCorners([
      {
        ...base,
        id: 'a',
        center: [2, 0, 0],
        rotation: 0,
      },
      {
        ...base,
        id: 'b',
        center: [0, 0, 2],
        rotation: Math.PI / 2,
      },
    ])
    expect(inside.map(wall => wall.miters)).toEqual([[1, 0], [0, 1]])
    const plain = miterCorners([inside[0], {
      ...inside[1],
      trimStyle: 'plain',
    }])
    expect(plain.map(wall => wall.miters)).toEqual([undefined, undefined])
    // Turned by 45° instead of 90°, like a bay’s corner, the bands meet on the wider angle’s bisector.
    const obtuse = miterCorners([inside[0], {
      ...inside[1],
      center: [-Math.SQRT2, 0, Math.SQRT2],
      rotation: Math.PI / 4,
    }])
    expect(obtuse[0].miters![0]).toBeCloseTo(bayMiter, 8)
    expect(obtuse[0].miters![1]).toBe(0)
    expect(obtuse[1].miters![0]).toBe(0)
    expect(obtuse[1].miters![1]).toBeCloseTo(bayMiter, 8)
  })
  // Where both walls ran their baseboards and cornices into the corner, the bands overlapped with shared tops, bottoms and fronts.
  // The casings of the tunnel’s doorway and the Corridor’s fill the corners beside them, of the east wall and of the bay’s back wall, up to their arches’ springing, so only the cornices meet there.
  for (const [first, second, baseboard] of [['lodge-south', 'lodge-east', true], ['lodge-south', 'lodge-west', true], ['vesper-north', 'vesper-west', true], ['lodge-northwest', 'lodge-west', true], ['lodge-northwest', 'lodge-north', false], ['lodge-north', 'lodge-northeast', false], ['lodge-northeast', 'lodge-east', false]] as const) {
    test(`${first} and ${second} meet with single, mitered trim surfaces`, () => {
      const a = wallById(first)
      const b = wallById(second)
      const meshes = [...wallMeshes(a), ...wallMeshes(b)]
      const corner = facesMeet(a, b)
      const floorY = a.center[1]
      const top = a.height
      // Off the miter line, a point in front of both faces lies on only one wall’s band.
      for (const [alongA, alongB] of [[0.04, 0.09], [0.09, 0.04]]) {
        const point = corner.clone().addScaledVector(inward(a), alongA).addScaledVector(inward(b), alongB)
        // the baseboard’s cap from above, the cornice’s lower band from below and its upper band from above
        const probes = [
          ...baseboard ? [[floorY + 1, -1, floorY + defaultBaseboardHeight]] as const : [],
          [floorY + top - 1, 1, floorY + top - 0.47],
          [floorY + top + 0.25, -1, floorY + top - 0.105],
        ] as const
        for (const [y, direction, expected] of probes) {
          const hits = nearestHits(meshes, new Vector3(point.x, y, point.z), new Vector3(0, direction, 0))
          expect(hits.map(hit => hit.object.name)).toHaveLength(1)
          expect(hits[0].point.y).toBeCloseTo(expected, 4)
        }
      }
    })
  }
  test('the bay’s 45° walls start behind the casings of the Lodge’s doorways beside them', () => {
    for (const [doorway, name, diagonal] of [['lodge-north', 'corridor', 'lodge-northwest'], ['lodge-north', 'corridor', 'lodge-northeast'], ['lodge-east', 'bastion', 'lodge-northeast']] as const) {
      const wall = wallById(doorway)
      const bay = wallById(diagonal)
      const hole = wall.holes!.find(value => value.name === name)!
      /** how far in front of the 45° wall’s log face the point lies */
      const inFront = (point: Vector3) => point.x * inward(bay).x + point.z * inward(bay).z - (bay.center[0] * inward(bay).x + bay.center[2] * inward(bay).z) - wallFace
      // The casing’s outer edge toward the bay, on the log face.
      const edges = [-1, 1].map(side => new Vector3(...wallPosition(wall, hole.u + side * (hole.width / 2 + wallOpeningTrim), wall.center[1], wallFace)))
      expect(Math.min(...edges.map(inFront))).toBeGreaterThan(0.03)
    }
  })
  test('the Lodge’s widened doorway keeps a plumb reveal beside the bay', () => {
    const bay = wallById('lodge-northeast')
    const east = wallById('lodge-east')
    const hole = east.holes![0]
    // The east wall runs north to south from its −x end; its doorway’s north jamb is the hole’s −u edge.
    const jambZ = east.center[2] + hole.u - hole.width / 2
    const meshes = [...wallMeshes(bay), ...wallMeshes(east)]
    // below the arch’s springing line, where the jamb is plumb
    for (const y of [0.2, 0.41, 1.1]) {
      // Across the jamb, from inside the doorway toward the north wall.
      const hits = nearestHits(meshes, new Vector3(east.center[0] - 0.05, lodge.floorY + y, jambZ + 0.5), new Vector3(0, 0, -1))
      expect(hits).toHaveLength(1)
      expect(hits[0].object.name).toBe('lodge-east/surface')
      expect(hits[0].point.z).toBeCloseTo(jambZ, 4)
    }
  })
})
describe('passage elbows', () => {
  for (const passage of [corridorPassage, corridorLanding, bastionMouth]) {
    test(`${passage.id}: walls close the inner corner of every elbow`, () => {
      const meshes = passageSurfaces(passage)
      const half = passage.width / 2
      for (const [i, [inner]] of passage.junctions.entries()) {
        const [x, z] = passage.path[i + 1]
        // The corner of both walls’ faces lies on the line from the elbow’s middle to the corner of their center lines inside the turn, as far before it as the faces stand in front of their walls’ center lines are to half the width.
        const faceCorner = new Vector3(inner[0] + (x - inner[0]) * wallFace / half, passage.floorY + 1.6, inner[1] + (z - inner[1]) * wallFace / half)
        const origin = new Vector3(x, passage.floorY + 1.6, z)
        // Aimed just past the corner of the faces, into what was an open wedge between both walls’ ends.
        const toCorner = faceCorner.clone().sub(origin).normalize()
        const target = faceCorner.clone().addScaledVector(toCorner, 0.03)
        const hits = nearestHits(meshes, origin, target.clone().sub(origin))
        expect(hits[0].distance).toBeLessThan(origin.distanceTo(faceCorner) + 1e-3)
      }
    })
  }
  test('timber passages roof only their elbows with slabs, below which the linings stop', () => {
    // Round the Lodge’s bay, the corridor turns by a right angle and twice by 45°, then by 45° onto the diagonal flight; the landing turns by 45° off it into the vestibule.
    for (const [passage, turns] of [[corridorPassage, [Math.PI / 2, Math.PI / 4, Math.PI / 4, Math.PI / 4]], [corridorLanding, [Math.PI / 4]]] as const) {
      expect(passage.junctions).toHaveLength(turns.length)
      for (const [i, junction] of passage.junctions.entries()) {
        const [x, z] = passage.path[i + 1]
        expect(insidePolygon(junction, x, z)).toBe(true)
        // Two right triangles, each as long as the passage is wide and reaching as far into the next span as its elbow does.
        expect(polygonArea(junction)).toBeCloseTo(passage.width ** 2 * Math.tan(turns[i] / 2), 6)
        expect(passage.spans[i].length - passage.spans[i].to).toBeCloseTo(passage.width / 2 * Math.tan(turns[i] / 2), 9)
        expect(passage.spans[i + 1].from).toBeCloseTo(passage.width / 2 * Math.tan(turns[i] / 2), 9)
      }
    }
    const geometry = TimberGeometry.passage(corridorPassage)
    disposables.push(geometry)
    // Along a span, the lining’s crown is the ceiling, in the plane a slab’s underside would occupy.
    const mesh = new Mesh(geometry.shell, material)
    const [x, z] = corridor.center
    const upward = new Raycaster(new Vector3(x, corridorPassage.floorY + 1, z), new Vector3(0, 1, 0))
    const hit = upward.intersectObject(mesh)[0]
    expect(hit.point.y).toBeCloseTo(corridorPassage.floorY + corridorPassage.height, 5)
    // Straight passages have no elbows.
    const straight = new Passage('straight', 'lodge', [[0, 0], [0, 6]], 0)
    expect(straight.junctions).toEqual([])
  })
  test('vault ribs never overlap, even on a short run before an elbow', () => {
    const vault = new VaultGeometry(bastionMouth)
    disposables.push(vault)
    const mesh = new Mesh(vault.ribs, material)
    const radius = bastionMouth.width / 2
    const spring = bastionMouth.floorY + bastionMouth.height - radius
    for (const [i, {start, end}] of bastionMouth.spans.entries()) {
      const direction = horizontal(end[0] - start[0], end[1] - start[1])
      // Through the ribs’ crowns, along the span, a little off its axis, where the triangles of the ribs’ faces meet.
      const origin = new Vector3(start[0], spring + radius - 0.04, start[1])
      origin.addScaledVector(direction, i ? radius : -0.5).addScaledVector(new Vector3(-direction.z, 0, direction.x), 0.013)
      const raycaster = new Raycaster(origin, direction)
      const hits = raycaster.intersectObject(mesh)
      expect(hits.length).toBeGreaterThan(0)
      // Entering and leaving alternate; overlapping ribs would enter twice in a row.
      for (const [index, hit] of hits.entries()) {
        expect(Math.sign(hit.face!.normal.dot(direction))).toBe(index % 2 ? 1 : -1)
      }
    }
  })
  test('vaults close their spandrels toward an elbow, up to its ceiling', () => {
    const vault = new VaultGeometry(bastionMouth)
    disposables.push(vault)
    const mesh = new Mesh(vault.shell, material)
    const radius = bastionMouth.width / 2
    const [x, z] = bastionMouth.path[1]
    const elbow = new Vector3(x, 0, z)
    for (const [i, {start, end}] of bastionMouth.spans.entries()) {
      // From the elbow, back along the span it ends or ahead along the span it starts.
      const direction = i ? horizontal(end[0] - start[0], end[1] - start[1]) : horizontal(start[0] - end[0], start[1] - end[1])
      const across = new Vector3(-direction.z, 0, direction.x)
      for (const side of [-1, 1]) {
        // Beside the vault’s arch, just under the elbow’s ceiling, where the turn used to look into the void behind the vault.
        for (const height of [bastionMouth.height - 0.05, bastionMouth.height - 0.6]) {
          const origin = elbow.clone().addScaledVector(across, side * (radius - wallFace - 0.15))
          origin.y = bastionMouth.floorY + height
          const raycaster = new Raycaster(origin, direction, 0, radius + 0.5)
          const hits = raycaster.intersectObject(mesh)
          expect(hits.length).toBeGreaterThan(0)
          expect(hits[0].distance).toBeLessThan(radius)
          expect(hits[0].distance).toBeGreaterThan(radius - wallFace - 0.05)
        }
      }
    }
  })
})
test('the reveal of the Lodge’s east window shares no plane with the Bastion’s stone it runs through', () => {
  const side = lodgeSpur.walls.find(wall => wall.holes?.some(hole => hole.name === 'lodge_window'))!
  const vault = new RouteVaultGeometry(lodgeSpur)
  const window = new LodgeEastWindowGeometry
  disposables.push(vault, window)
  const meshes = [...wallMeshes(side), new Mesh(vault.shell, material), new Mesh(window.lining, material)]
  const {z, width, bottom, top, border} = lodgeEastWindow
  const face = lodgeSpurX - lodgeSpurWidth / 2 + wallFace
  const middleY = (bottom + top) / 2
  const origin = new Vector3(lodgeSpurX, middleY, z)
  // Straight at the reveal’s jamb on the passage’s face, then from the passage’s middle at its jambs, sill and head within the stone’s depth, the head also where the vault’s shell takes over from the wall.
  const probes: Array<readonly [from: Vector3, target: readonly [number, number, number]]> = [
    [new Vector3(lodgeSpurX, middleY, z - width / 2 - border / 2), [face - 0.01, middleY, z - width / 2 - border / 2]],
    ...[-1, 1].map(edge => [origin, [face - 0.05, middleY, z + edge * width / 2]] as const),
    [origin, [face - 0.05, bottom, z]],
    ...[0.05, 0.2].map(depth => [origin, [face - depth, top, z]] as const),
  ]
  for (const [from, target] of probes) {
    const direction = new Vector3(...target)
    expect(nearestHits(meshes, from, direction.sub(from))).toHaveLength(1)
  }
})
describe('Lodge furniture', () => {
  for (const seats of [1, 3]) {
    test(`a ${seats}-seat frame keeps its rear and ends off the arms’ faces`, () => {
      const geometry = new UpholsteredSeatGeometry(seats)
      disposables.push(geometry)
      const mesh = new Mesh(geometry.leather, material)
      const {depth, armWidth} = UpholsteredSeatGeometry
      // From behind, across the arm and the back frame: one surface each, never two in the same plane.
      for (const [x, y] of [[geometry.width / 2 - armWidth / 2, 0.4], [0, 0.27], [0, 0.6], [geometry.width / 2 - 0.05, 0.27]]) {
        const hits = nearestHits([mesh], new Vector3(x, y, -2), new Vector3(0, 0, 1))
        expect(hits).toHaveLength(1)
      }
      // From the side, across the arm.
      for (const y of [0.3, 0.5]) {
        expect(nearestHits([mesh], new Vector3(3, y, -depth / 2 + 0.1), new Vector3(-1, 0, 0))).toHaveLength(1)
      }
    })
  }
})
