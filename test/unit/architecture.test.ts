import type {Wall, WallOpening} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {computeMeshVolume} from 'three-bvh-csg'
import {BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, ShapeUtils, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry, openingSegments, openingShape, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {baseboardCapHeight, defaultBaseboardHeight} from '../../src/lib/gallery/architectureDimensions.ts'
import {insideOpening, openingArc, openingCircle, openingTop} from '../../src/lib/placement/wallGeometry.ts'
import walls, {galleryPlacement} from './fixtures/gallery.ts'

await RAPIER.init()
/** where a point of a wall’s flat layout, `u` along it and `depth` out of its center line, lies once the wall bends round its curve */
const bent = ({curveRadius: radius}: Wall, u: number, depth: number): readonly [number, number] => (radius ? [(radius - depth) * Math.sin(u / radius), radius - (radius - depth) * Math.cos(u / radius)] : [u, depth])
/** the area of an opening in its wall, a segmental arch’s segment over the rectangle up to where it springs, or a round opening’s circle */
const openingArea = (hole: WallOpening) => {
  if (hole.profile === 'round') {
    return Math.PI * openingCircle(hole).radius ** 2
  }
  const bottom = hole.bottom ?? 0
  if (hole.profile !== 'arch') {
    return hole.width * (hole.height - bottom)
  }
  const {radius, center} = openingArc(hole)
  const half = Math.asin(Math.min(1, hole.width / 2 / radius))
  const rise = hole.height - center - radius * Math.cos(half)
  return hole.width * (hole.height - rise - bottom) + radius ** 2 * (2 * half - Math.sin(2 * half)) / 2
}
describe('physical mesh topology', () => {
  for (const indexed of [false, true]) {
    test(`welds render seams and removes degenerate faces without changing the source, indexed ${indexed}`, () => {
      const geometry = new BufferGeometry
      const positions = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]
      const uv = Array.from({length: 18}, (_, i) => i / 18)
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
      if (indexed) {
        geometry.setIndex(Array.from({length: 9}, (_, i) => i))
      }
      const originalUv = [...geometry.getAttribute('uv').array]
      const originalIndex = geometry.index
      try {
        const [vertices, indices] = colliderGeometry(geometry)
        expect(vertices).toHaveLength(12)
        expect(indices).toHaveLength(6)
        const referencedVertices = new Set(indices)
        expect(referencedVertices.size).toBe(4)
        expect([...geometry.getAttribute('position').array]).toEqual(positions)
        expect([...geometry.getAttribute('uv').array]).toEqual(originalUv)
        expect(geometry.index).toBe(originalIndex)
        vertices[0] = 99
        expect(geometry.getAttribute('position').getX(0)).toBe(0)
      } finally {
        geometry.dispose()
      }
    })
  }
})
describe('boolean architecture', () => {
  const wallsWithOpenings = walls.filter(wall => wall.holes?.length)
  for (const wall of wallsWithOpenings) {
    test(`${wall.id}: curved openings match the visible solid and physical collision on both faces`, () => {
      const geometry = createArchitectureGeometry(wall)
      const material = new MeshBasicMaterial({side: DoubleSide})
      const meshes = [geometry.surface, ...geometry.trim].map(partGeometry => new Mesh(partGeometry, material))
      const world = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      try {
        for (const [vertices, indices] of geometry.collision) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices))
        }
        world.step()
        for (const hole of wall.holes!) {
          // Sample the jambs, upper corners and crown, staying off exact cut edges, like the cuts that curve a wall through the middle of an opening.
          for (const offset of [-1.45, -1.19, -0.6, 0.013, 0.6, 1.19, 1.45]) {
            const u = hole.u + offset
            for (const y of [0.2, 1.62, 2.5, 3.2, 3.55, 3.75, 3.9, 4.1]) {
              if (y >= wall.height + 0.3 - 0.001) {
                continue
              }
              const opening = wall.holes!.find(candidate => insideOpening(candidate, u, y))
              const solid = Math.abs(u) <= wall.width / 2 && !opening
              for (const side of [-1, 1]) {
                // Through the wall where it stands at u, which on a curved wall runs toward its curve’s center
                const [x, z] = bent(wall, u, side)
                const [toX, toZ] = bent(wall, u, -side)
                const origin = new Vector3(x, y + (wall.slope ?? 0) * u, z)
                const direction = new Vector3(toX - x, 0, toZ - z)
                direction.normalize()
                const ray = new Raycaster(origin, direction, 0, 2)
                expect(ray.intersectObject(meshes[0]).length > 0).toBe(solid)
                expect(ray.intersectObjects(meshes).length > 0).toBe(solid)
                expect(!!world.castRay(new RAPIER.Ray(origin, direction), 2, true)).toBe(solid || !!opening?.glassThickness)
              }
            }
          }
        }
        // A wall cut to a tolerance cuts its openings’ arches into as few chords as keep within it; its cut is measured against them.
        const cutArea = (hole: WallOpening) => (wall.curveTolerance === undefined ? openingArea(hole) : Math.abs(ShapeUtils.area(openingShape(hole, 0, hole.bottom ?? 0).getPoints(openingSegments(wall, hole)))))
        const area = wall.width * (wall.height + 0.3) - wall.holes!.reduce((sum, hole) => sum + cutArea(hole), 0)
        // A curved wall is cut flat before it bends, which leaves the cut’s T-junctions a hair apart; its cut is measured flat.
        const flat = wall.curveRadius ? createArchitectureGeometry({
          ...wall,
          curveRadius: undefined,
        }) : geometry
        expect(computeMeshVolume(flat.surface)).toBeCloseTo(area * wallFace, 3)
        if (flat !== geometry) {
          flat.dispose()
        }
        if (!wall.curveRadius) {
          expect(geometry.surface.boundingBox!.min.z).toBeCloseTo(0)
          expect(geometry.surface.boundingBox!.max.z).toBeCloseTo(wallFace)
        }
        for (const mesh of meshes) {
          for (const name of ['position', 'normal', 'uv']) {
            expect([...mesh.geometry.getAttribute(name).array].every(Number.isFinite)).toBe(true)
          }
        }
      } finally {
        world.free()
        material.dispose()
        geometry.dispose()
      }
    })
  }
  for (const wall of wallsWithOpenings) {
    test(`${wall.id}: doorway reveals have exactly one visible face through the plaster, baseboard and plinth`, () => {
      // A curved wall is cut flat before it bends; its cut is checked flat, and the bend through it above.
      const geometry = createArchitectureGeometry({
        ...wall,
        curveRadius: undefined,
      })
      const material = new MeshBasicMaterial
      try {
        const meshes = [geometry.surface, ...geometry.trim].map(partGeometry => new Mesh(partGeometry, material))
        for (const hole of wall.holes!) {
          for (const side of [-1, 1]) {
            // 40 cm past the jamb, or up to the casing of the next opening on that side at its height, if that comes first
            const jamb = hole.u + side * hole.width / 2
            const beside = wall.holes!.filter(other => other !== hole && (other.u - hole.u) * side > 0 && (other.bottom ?? 0) - wallOpeningTrim < hole.height && other.height + wallOpeningTrim > (hole.bottom ?? 0))
            // Classic doorway plinths extend another 6.5 cm beyond their casing, including beside bare openings.
            const clear = Math.min(0.4, ...beside.map(other => (other.u - side * (other.width / 2 + wallOpeningTrim + (other.casing === false || wall.trimStyle === 'plain' ? 0 : 0.065)) - jamb) * side - 0.01))
            for (const offsetY of [0.14, 0.393, 0.417, 0.613, 1.731]) {
              if (offsetY >= hole.height - (hole.bottom ?? 0)) {
                continue
              }
              const y = (hole.bottom ?? 0) + offsetY
              for (const z of [0.051, 0.092, 0.121, 0.183, 0.231, 0.259, 0.301]) {
                const classicDepth = y < 0.4 ? 0.325 : 0.27
                let depth = wall.trimStyle === 'plain' ? 0.25 : classicDepth
                // An opening that reaches the wall’s end has no reveal there.
                if (wall.width / 2 - side * jamb < 1e-3) {
                  depth = 0
                } else if (wall.trimStyle === 'none') {
                  depth = wallFace
                } else if (hole.casing === false) {
                  // Without a casing, only the baseboard stands out of the reveal; at a corner, it runs on square.
                  const baseboard = wall.baseboardHeight ?? defaultBaseboardHeight
                  // A sloping floor can bring the taller cap into a horizontal ray farther beyond the jamb.
                  // Sample both ends and intervening knots of the exposed baseboard along the ray.
                  const profile = wall.baseboardProfile
                  const floorAt = (u: number) => {
                    if (!profile) {
                      return 0
                    }
                    const above = profile.findIndex(([at]) => at >= u)
                    if (above === -1) {
                      return profile.at(-1)![1]
                    }
                    if (above === 0) {
                      return profile[0][1]
                    }
                    const [u0, y0] = profile[above - 1]
                    const [u1, y1] = profile[above]
                    return y0 + (y1 - y0) * (u - u0) / (u1 - u0)
                  }
                  const end = hole.u + side * (hole.width / 2 + clear)
                  const floors = [floorAt(jamb), floorAt(end), ...profile?.filter(([u]) => u >= Math.min(jamb, end) && u <= Math.max(jamb, end)).map(([, height]) => height) ?? []]
                  const highestFloor = Math.max(...floors)
                  const lowestFloor = Math.min(...floors)
                  const lowerBand = baseboard - (wall.baseboardCapHeight ?? baseboardCapHeight)
                  // Under a floor standing higher than the wall’s foot, the jamb runs on bare, like over the baseboard.
                  if (y >= highestFloor + baseboard || y < lowestFloor) {
                    depth = wallFace
                  } else if (y >= lowestFloor + lowerBand && y < highestFloor + baseboard) {
                    depth = 0.25
                  } else {
                    depth = 0.2
                  }
                }
                const direction = new Vector3(side, side * (wall.slope ?? 0), 0)
                direction.normalize()
                const ray = new Raycaster(new Vector3(hole.u, y + (wall.slope ?? 0) * hole.u, z), direction, 0, hole.width / 2 + clear)
                const hits = ray.intersectObjects(meshes)
                expect(hits.length).toBe(z < depth ? 1 : 0)
                if (hits.length === 0) {
                  continue
                }
                if (hole.casing === false && wall.baseboardProfile && hits[0].distance > hole.width / 2 + 1e-5) {
                  // The rising baseboard can enter the ray beyond the jamb, where its top meets the ray's height.
                  expect(hits[0].distance).toBeLessThanOrEqual(hole.width / 2 + clear + 1e-5)
                  continue
                }
                if (hole.profile === 'round') {
                  // Across a round opening, as far as its circle reaches at that height
                  const {radius, center} = openingCircle(hole)
                  expect(Math.abs(hits[0].distance - Math.sqrt(radius ** 2 - (y - center) ** 2))).toBeLessThan(0.002)
                  continue
                }
                const {radius, center} = openingArc(hole)
                if (hole.profile === 'arch' && y > openingTop(hole, hole.u + hole.width / 2 - 1e-9)) {
                  // Wider arches start curving lower; their reveal is not a vertical jamb.
                  const reach = Math.sqrt(radius ** 2 - (y - center) ** 2)
                  expect(Math.abs(hits[0].distance - reach)).toBeLessThan(0.001)
                } else {
                  expect(hits[0].distance).toBeCloseTo(hole.width / 2 * Math.hypot(1, wall.slope ?? 0), 5)
                }
              }
            }
          }
        }
      } finally {
        material.dispose()
        geometry.dispose()
      }
    })
  }
  const rakingWalls = walls.filter(wall => wall.slope && wall.trimStyle !== 'none')
  test('there are raking cornices to check', () => {
    expect(rakingWalls.length).toBeGreaterThanOrEqual(4)
  })
  for (const wall of rakingWalls) {
    test(`${wall.id}: raking cornice bands end plumb and flush with the wall, keeping the level profile`, () => {
      const geometry = createArchitectureGeometry(wall)
      const level = createArchitectureGeometry({
        ...wall,
        slope: 0,
      })
      try {
        expect(geometry.cornice).toHaveLength(2)
        for (const [i, part] of geometry.cornice.entries()) {
          const box = part.boundingBox!
          const levelBox = level.cornice[i].boundingBox!
          // No end may overshoot into a doorway reveal or stop short of the adjoining landing cornice.
          expect(box.min.x).toBeCloseTo(-wall.width / 2, 6)
          expect(box.max.x).toBeCloseTo(wall.width / 2, 6)
          expect(box.min.z).toBeCloseTo(levelBox.min.z, 6)
          expect(box.max.z).toBeCloseTo(levelBox.max.z, 6)
          const positions = part.getAttribute('position')
          const normals = part.getAttribute('normal')
          for (const end of [-1, 1]) {
            const u = end * wall.width / 2
            const heights: Array<number> = []
            for (let vertex = 0; vertex < positions.count; vertex++) {
              if (Math.abs(positions.getX(vertex) - u) < 1e-6) {
                heights.push(positions.getY(vertex) - u * wall.slope!)
              }
            }
            // Every vertex at the wall end lies in one vertical plane, with the level band’s exact section.
            expect(Math.min(...heights)).toBeCloseTo(levelBox.min.y, 6)
            expect(heights.length).toBeGreaterThan(0)
            expect(Math.max(...heights)).toBeCloseTo(levelBox.max.y, 6)
          }
          for (let vertex = 0; vertex < normals.count; vertex++) {
            expect(Math.hypot(normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex))).toBeCloseTo(1, 5)
          }
          // Sheared boxes keep their volume: section height × depth × run, up to the triangulation’s rounding on a long slope.
          expect(computeMeshVolume(part)).toBeCloseTo(computeMeshVolume(level.cornice[i]), 5)
        }
      } finally {
        level.dispose()
        geometry.dispose()
      }
    })
  }
  test('placement rays hit the solid arch shoulders, not the opening beneath them', () => {
    const wall = walls.find(candidate => candidate.id === 'lobby-east')!
    const hole = wall.holes![0]
    expect(openingTop(hole, hole.u)).toBeCloseTo(3.8)
    expect(openingTop(hole, hole.u + 1.2)).toBeLessThan(3.2)
    expect(galleryPlacement.findPlacement([5, 3.5, wall.center[2] + hole.u + 1.2], [1, 0, 0], 0, 0, [])?.wallId).toBe(wall.id)
    expect(galleryPlacement.findPlacement([5, 3.5, wall.center[2] + hole.u], [1, 0, 0], 0, 0, [])).toMatchObject({
      wallId: 'banquet-east',
      inReach: false,
      valid: false,
    })
  })
  test('supports multiple independent openings without leaving a bottom sill', () => {
    const wall = {
      ...walls[0],
      holes: [
        {
          u: -3,
          width: 2,
          height: 3.5,
          profile: 'arch' as const,
        },
        {
          u: 3,
          width: 2.5,
          height: 3.6,
          profile: 'rectangle' as const,
        },
      ],
    }
    const geometry = createArchitectureGeometry(wall)
    const material = new MeshBasicMaterial({side: DoubleSide})
    try {
      const meshes = [geometry.surface, ...geometry.trim].map(partGeometry => new Mesh(partGeometry, material))
      for (const hole of wall.holes) {
        for (const y of [0.001, 1.62, 3.4]) {
          const openingRay = new Raycaster(new Vector3(hole.u, y, 1), new Vector3(0, 0, -1), 0, 2)
          expect(openingRay.intersectObjects(meshes)).toHaveLength(0)
        }
      }
      const solidWallRay = new Raycaster(new Vector3(0, 1.62, 1), new Vector3(0, 0, -1), 0, 2)
      expect(solidWallRay.intersectObjects(meshes).length).toBeGreaterThan(0)
    } finally {
      material.dispose()
      geometry.dispose()
    }
  })
})
