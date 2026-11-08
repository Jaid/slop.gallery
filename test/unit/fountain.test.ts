import type {BufferGeometry} from 'three/webgpu'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import EntranceGeometry from '../../src/lib/gallery/EntranceGeometry.ts'
import {fountainBench, fountainBenches} from '../../src/lib/gallery/fountain/benches.ts'
import fountain, {jetApex, jetFlightTime, jetLanding, jetPoint, jetSpeedFor, sheetFlightTime, sheetLanding, sheetPoint} from '../../src/lib/gallery/fountain/config.ts'
import FountainGeometry from '../../src/lib/gallery/fountain/FountainGeometry.ts'
import FountainSpray, {dropLanding, fountainDroplets} from '../../src/lib/gallery/fountain/FountainSpray.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import LobedProfileGeometry from '../../src/lib/gallery/LobedProfileGeometry.ts'
import RevolvedProfileGeometry from '../../src/lib/gallery/RevolvedProfileGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import FountainMarbleMaterial from '../../src/lib/materials/FountainMarbleMaterial.ts'
import FountainWaterMaterial from '../../src/lib/materials/FountainWaterMaterial.ts'
import TransparentSpriteOutputsNode from '../../src/lib/rendering/TransparentSpriteOutputsNode.ts'

await RAPIER.init()
const down = new Vector3(0, -1, 0)
/** Every face’s winding agrees with its shading normals, so single-sided materials and shadows see the outside. */
function frontFacesMatchNormals(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.index!
  const [a, b, c, face, shading, n] = Array.from({length: 6}, () => new Vector3)
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1)).sub(a)
    c.fromBufferAttribute(position, index.getX(i + 2)).sub(a)
    face.crossVectors(b, c)
    shading.set(0, 0, 0)
    for (let j = 0; j < 3; j++) {
      shading.add(n.fromBufferAttribute(normal, index.getX(i + j)))
    }
    if (face.dot(shading) <= 0) {
      return false
    }
  }
  return true
}
/** Height of the first surface of `mesh` under a point, measured from above. */
function surfaceAt(mesh: Mesh, radius: number, angle = 0, from = 5) {
  const ray = new Raycaster(new Vector3(radius * Math.cos(angle), from, -radius * Math.sin(angle)), down)
  return ray.intersectObject(mesh)[0]?.point.y ?? Number.NaN
}
describe('revolved profiles', () => {
  test('octagon sides sit exactly at the profile’s apothem, with hard carved corners', () => {
    const geometry = new RevolvedProfileGeometry([[0, 1], [1, 1], [1, 0]], {sides: 8})
    try {
      const mesh = new Mesh(geometry, new MeshBasicMaterial)
      const sideRay = new Raycaster(new Vector3(3, 0.5, 0.2), new Vector3(-1, 0, 0))
      const side = sideRay.intersectObject(mesh)[0]
      expect(side.point.x).toBeCloseTo(1, 6)
      expect(side.face!.normal.x).toBeCloseTo(1, 6)
      const position = geometry.getAttribute('position')
      const corners = Array.from({length: position.count}, (_, i) => Math.hypot(position.getX(i), position.getZ(i)))
      expect(Math.max(...corners)).toBeCloseTo(1 / Math.cos(Math.PI / 8), 6)
      // Each flat side keeps its own normals: 8 sides × (wall quad + cap triangle) with no shared corner normals.
      const normal = geometry.getAttribute('normal')
      for (let i = 0; i < normal.count; i++) {
        const horizontal = Math.hypot(normal.getX(i), normal.getZ(i))
        expect(horizontal < 1e-6 || Math.abs(horizontal - 1) < 1e-6).toBe(true)
      }
      expect(frontFacesMatchNormals(geometry)).toBe(true)
      expect(triangleCount(geometry)).toBe(8 * 3)
    } finally {
      geometry.dispose()
    }
  })
  test('fine polygons shade round, and gentle profile bends shade smooth', () => {
    const geometry = new RevolvedProfileGeometry([[0, 0], [1, 0.05], [1.2, 0.15]], {sides: 32})
    try {
      // A vertex shared by neighboring sides is shaded along the radius through it, not along either side.
      expect(geometry.getAttribute('position').count).toBeLessThan(32 * 3 + 3)
      const position = geometry.getAttribute('position')
      const normal = geometry.getAttribute('normal')
      for (let i = 0; i < position.count; i++) {
        const radius = Math.hypot(position.getX(i), position.getZ(i))
        if (radius < 1e-6) {
          continue
        }
        const horizontal = Math.hypot(normal.getX(i), normal.getZ(i))
        if (horizontal > 1e-6) {
          expect(Math.abs(position.getX(i) * normal.getX(i) + position.getZ(i) * normal.getZ(i)) / radius / horizontal).toBeCloseTo(1, 6)
        }
      }
      expect(frontFacesMatchNormals(geometry)).toBe(true)
    } finally {
      geometry.dispose()
    }
  })
  test('invalid profiles are rejected', () => {
    expect(() => new RevolvedProfileGeometry([[0, 0]], {sides: 8})).toThrow(RangeError)
    expect(() => new RevolvedProfileGeometry([[0, 0], [-1, 0]], {sides: 8})).toThrow(RangeError)
    expect(() => new RevolvedProfileGeometry([[0, 0], [1, 0]], {sides: 2})).toThrow(RangeError)
  })
})
describe('lobed profiles', () => {
  test('a scalloped lip swells on its lobes and sinks between them, closed and outward without a seam', () => {
    const geometry = new LobedProfileGeometry([[0, 1, 0, 0], [0.5, 1.02, 0.02, -0.01], [0.5, 0, 0, 0]], {
      lobes: 8,
      segmentsPerLobe: 4,
    })
    try {
      const mesh = new Mesh(geometry, new MeshBasicMaterial)
      // Crests at the lobes, troughs between them: wider and higher, narrower and lower.
      const inward = (angle: number, y: number) => {
        const ray = new Raycaster(new Vector3(Math.cos(angle), y, -Math.sin(angle)), new Vector3(-Math.cos(angle), 0, Math.sin(angle)))
        return ray.intersectObject(mesh)[0]
      }
      const crest = inward(0, 1.01)
      const trough = inward(Math.PI / 8, 1)
      expect(Math.hypot(crest.point.x, crest.point.z)).toBeCloseTo(0.52, 3)
      expect(Math.hypot(trough.point.x, trough.point.z)).toBeCloseTo(0.48, 3)
      expect(surfaceAt(mesh, 0.3)).toBeGreaterThan(surfaceAt(mesh, 0.3, Math.PI / 8))
      expect(surfaceAt(mesh, 0.51)).toBeCloseTo(1.02, 3)
      expect(frontFacesMatchNormals(geometry)).toBe(true)
      // The seam’s two vertices share one normal, so nothing shades differently across it.
      const normal = geometry.getAttribute('normal')
      const ringLength = 8 * 4 + 1
      for (let ring = 0; ring < normal.count / ringLength; ring++) {
        const first = ring * ringLength
        const last = first + ringLength - 1
        expect(normal.getX(first)).toBeCloseTo(normal.getX(last), 6)
        expect(normal.getY(first)).toBeCloseTo(normal.getY(last), 6)
        expect(normal.getZ(first)).toBeCloseTo(normal.getZ(last), 6)
      }
      // The mesh is watertight around the axis: a ray from inside leaves through exactly one face in every direction, the seam included.
      const doubleSided = new Mesh(geometry, new MeshBasicMaterial({side: DoubleSide}))
      for (const angle of [0, 0.1, 1.3, 2.9, 4.2, Math.PI * 2 - 1e-4]) {
        const outward = new Raycaster(new Vector3(0, 0.5, 0), new Vector3(Math.cos(angle), 0, -Math.sin(angle)))
        expect(outward.intersectObject(doubleSided)).toHaveLength(1)
      }
    } finally {
      geometry.dispose()
    }
  })
  test('a sharp bend along the profile is a crease, a gentle one shades smooth', () => {
    const creased = new LobedProfileGeometry([[0.5, 1, 0, 0], [0.5, 0.5, 0, 0], [1, 0.5, 0, 0]], {
      lobes: 4,
      segmentsPerLobe: 4,
    })
    const smooth = new LobedProfileGeometry([[0.5, 1, 0, 0], [0.5, 0.5, 0, 0], [0.55, 0.3, 0, 0]], {
      lobes: 4,
      segmentsPerLobe: 4,
    })
    try {
      // Rings: 3 points, the middle one doubled at the crease.
      expect(creased.getAttribute('position').count).toBe(4 * 17)
      expect(smooth.getAttribute('position').count).toBe(3 * 17)
    } finally {
      creased.dispose()
      smooth.dispose()
    }
  })
  test('invalid lobed profiles are rejected', () => {
    expect(() => new LobedProfileGeometry([[0, 0, 0, 0]], {lobes: 4})).toThrow(RangeError)
    expect(() => new LobedProfileGeometry([[0.1, 0, 0.2, 0], [1, 0, 0, 0]], {lobes: 4})).toThrow(RangeError)
    expect(() => new LobedProfileGeometry([[0, 0, 0, 0], [1, 0, 0, 0]], {lobes: 1})).toThrow(RangeError)
  })
})
describe('Lobby fountain', () => {
  test('the octagonal fountain is lean, finite, below the chandelier and clear of the glass floor and benches', () => {
    const geometry = new FountainGeometry
    try {
      expect(fountain.position[0]).toBe(0)
      const parts = [geometry.stone, geometry.gilt, geometry.pools, geometry.water]
      const bounds = new Box3
      for (const part of parts) {
        part.computeBoundingBox()
        bounds.union(part.boundingBox!)
        expect(part.index).not.toBeNull()
        for (const attribute of Object.values(part.attributes)) {
          expect([...(attribute as {array: Iterable<number>}).array].every(Number.isFinite)).toBe(true)
        }
      }
      // Lobed bowls and fluted balusters are the bulk of it; the first fountain of the Lobby needed about 32k triangles.
      expect(parts.reduce((sum, part) => sum + triangleCount(part), 0)).toBeLessThan(20_000)
      expect(triangleCount(geometry.stone)).toBeLessThan(10_000)
      expect(triangleCount(geometry.gilt)).toBeLessThan(4000)
      // The stone and gilt reach the finial’s tip; the water column rises past it and its apex stays well under the chandelier’s lowest drop.
      expect(geometry.gilt.boundingBox!.max.y).toBeGreaterThan(3)
      expect(geometry.gilt.boundingBox!.max.y).toBeLessThan(3.1)
      expect(geometry.stone.boundingBox!.max.y).toBeLessThan(2.8)
      expect(bounds.max.y).toBeGreaterThan(4)
      expect(fountain.jet.y + fountain.jet.speed ** 2 / (2 * fountain.gravity)).toBeLessThan(5.5)
      // Flat sides face the benches along x and z.
      expect(bounds.max.x).toBeCloseTo(fountain.basinApothem, 5)
      expect(bounds.min.z).toBeCloseTo(-fountain.basinApothem, 5)
      expect(fountain.position[2] - fountain.radius).toBeGreaterThan(lobby.opening.center[1] + lobby.opening.size[1] / 2 + 1)
      expect(fountainBench.radius - fountainBench.depth / 2 - fountain.basinApothem).toBeGreaterThan(1.4)
      expect(fountainBenches).toHaveLength(4)
    } finally {
      geometry.dispose()
    }
  })
  test('stone and gilt are closed toward the outside, so shadows and single-sided shading stay correct', () => {
    const geometry = new FountainGeometry
    try {
      expect(frontFacesMatchNormals(geometry.stone)).toBe(true)
      expect(frontFacesMatchNormals(geometry.gilt)).toBe(true)
    } finally {
      geometry.dispose()
    }
  })
  test('each bowl brims between the crests and troughs of its scalloped lip and each veil lands inside the pool below', () => {
    const {veils, pools, lips, lobes, basinInnerApothem} = fountain
    const geometry = new FountainGeometry
    const material = new MeshBasicMaterial
    try {
      const stone = new Mesh(geometry.stone, material)
      for (const [sheet, pool, lip, count] of [[veils.lower, pools.lower, lips.lower, lobes.lower], [veils.upper, pools.upper, lips.upper, lobes.upper]] as const) {
        expect(sheet.y).toBe(pool)
        // Water fills the bowl a hair under the crests of the lip and pours over the troughs between them.
        const crest = Math.max(...Array.from({length: 61}, (_, i) => surfaceAt(stone, lip.radius + lip.scallop - 0.03 + i * 0.001)))
        const trough = Math.max(...Array.from({length: 61}, (_, i) => surfaceAt(stone, lip.radius - lip.scallop - 0.03 + i * 0.001, Math.PI / count)))
        expect(crest).toBeGreaterThan(pool)
        expect(crest).toBeLessThan(pool + 0.006)
        expect(trough).toBeLessThan(pool)
        expect(trough).toBeGreaterThan(pool - 0.02)
        expect(sheetFlightTime(sheet)).toBeGreaterThan(0)
      }
      expect(sheetLanding(veils.upper)).toBeLessThan(lips.lower.radius - lips.lower.scallop - 0.2)
      expect(sheetLanding(veils.lower)).toBeLessThan(basinInnerApothem - 0.2)
      // Veils must pass outside the bowl below them rather than through its stone, including their scallops. Right under the lip the water still clings to the stone’s flank.
      for (const [sheet, lip, count] of [[veils.upper, lips.upper, lobes.upper], [veils.lower, lips.lower, lobes.lower]] as const) {
        const duration = sheetFlightTime(sheet)
        for (let i = 1; i <= 20; i++) {
          const [radius, y] = sheetPoint(sheet, duration * i / 20)
          if (y > sheet.y - 0.08) {
            continue
          }
          for (const [angle, offset] of [[0, lip.scallop], [Math.PI / count, -lip.scallop]]) {
            const surface = surfaceAt(stone, radius + offset, angle, y)
            expect(Number.isNaN(surface) || surface < y - 0.02).toBe(true)
          }
        }
      }
      // The pools’ water surfaces are where the material and the physics expect them.
      const water = new Mesh(geometry.pools, material)
      for (const [radius, y] of [[1.4, pools.basin], [0.7, pools.lower], [0.2, pools.upper]]) {
        expect(surfaceAt(water, radius, 0.013)).toBeCloseTo(y, 6)
      }
    } finally {
      material.dispose()
      geometry.dispose()
    }
  })
  test('the basin nozzles and the lily jets arc into the bowls, clear of their lips', () => {
    const {basinNozzles, lilyJets, lips, pools, basinInnerApothem} = fountain
    expect(basinNozzles).toHaveLength(8)
    for (const nozzle of basinNozzles) {
      const {jet, foot} = nozzle
      // The nozzle rises out of the basin’s water from a foot on its floor, inside the corner.
      expect(jet.start[1]).toBeGreaterThan(pools.basin)
      expect(foot[1]).toBeLessThan(pools.basin)
      expect(Math.hypot(foot[0], foot[2])).toBeLessThan(basinInnerApothem / Math.cos(Math.PI / 8) - 0.05)
      const landing = jetLanding(jet)
      expect(landing[1]).toBeCloseTo(pools.lower, 6)
      expect(Math.hypot(landing[0], landing[2])).toBeLessThan(lips.lower.radius - lips.lower.scallop - 0.1)
      // The arc clears the lower bowl’s lip on its way in and stays under the chandelier.
      const duration = jetFlightTime(jet)
      for (let i = 0; i <= 200; i++) {
        const [x, y, z] = jetPoint(jet, duration * i / 200)
        if (Math.abs(Math.hypot(x, z) - (lips.lower.radius + lips.lower.scallop)) < 0.03) {
          expect(y).toBeGreaterThan(lips.lower.y + 0.15)
        }
      }
      expect(jetApex(jet)).toBeLessThan(lips.upper.y)
      // The nozzle leans along its own stream.
      const lean = new Vector3(...jet.start)
      lean.sub(new Vector3(...foot)).normalize()
      expect(lean.y).toBeCloseTo(Math.sin(jet.elevation), 6)
    }
    expect(lilyJets).toHaveLength(6)
    for (const {jet} of lilyJets) {
      const landing = jetLanding(jet)
      expect(landing[1]).toBeCloseTo(pools.upper, 6)
      expect(Math.hypot(landing[0], landing[2])).toBeLessThan(lips.upper.radius - lips.upper.scallop - 0.1)
      expect(Math.hypot(landing[0], landing[2])).toBeGreaterThan(0.2)
    }
    expect(jetSpeedFor(Math.PI / 4, 0, 1)).toBeCloseTo(Math.sqrt(fountain.gravity), 6)
    expect(() => jetSpeedFor(Math.PI / 4, -2, 1)).toThrow(RangeError)
  })
  test('the basin is hollow and uses the same carved mesh for physics and visible surfaces', () => {
    const geometry = new FountainGeometry
    const material = new MeshBasicMaterial
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    try {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry.stone), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
      world.step()
      const mesh = new Mesh(geometry.stone, material)
      for (const x of [0, 0.3, 0.7, 1.3, 1.75, 1.93, 2.1]) {
        const origin = new Vector3(x, 5, 0.013)
        const visualRay = new Raycaster(origin, down)
        const visual = visualRay.intersectObject(mesh).at(0)
        const physical = world.castRay(new RAPIER.Ray(origin, down), 6, true)
        expect(!!physical).toBe(!!visual)
        if (visual && physical) {
          expect(5 - physical.timeOfImpact).toBeCloseTo(visual.point.y, 4)
        }
      }
      const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(1.3, 1, 0))
      world.createCollider(RAPIER.ColliderDesc.ball(0.1), ball)
      for (let i = 0; i < 240; i++) {
        world.step()
      }
      expect(ball.translation().y).toBeCloseTo(fountain.basinFloor + 0.1, 2)
      expect(ball.translation().y).toBeLessThan(fountain.poolY)
      expect(ball.translation().x).toBeCloseTo(1.3, 2)
    } finally {
      world.free()
      material.dispose()
      geometry.dispose()
    }
  })
  test('water, marble and spray are real animated node graphs, with transmission omitted in fast mode', () => {
    for (const falling of [false, true]) {
      for (const heavy of [false, true]) {
        const material = new FountainWaterMaterial(falling, heavy)
        expect(material.isMeshPhysicalNodeMaterial).toBe(true)
        expect(material.positionNode !== null).toBe(falling)
        expect(material.normalNode).not.toBeNull()
        expect(material.opacityNode).not.toBeNull()
        expect(material.ior).toBeCloseTo(1.333)
        expect(material.transmission > 0).toBe(heavy)
        expect(material.transmissionNode !== null).toBe(true)
        expect(material.transparent).toBe(falling || !heavy)
        material.dispose()
      }
    }
    const marble = new FountainMarbleMaterial
    expect(marble.colorNode).not.toBeNull()
    expect(marble.roughnessNode).not.toBeNull()
    expect(marble.clearcoatNode).not.toBeNull()
    expect(marble.normalNode).not.toBeNull()
    marble.dispose()
    const geometry = new FountainGeometry
    try {
      for (const name of ['waterFall', 'waterAir', 'waterLobe']) {
        const attribute = geometry.water.getAttribute(name)
        expect(attribute.count).toBe(geometry.water.getAttribute('position').count)
        expect([...(attribute as {array: Iterable<number>}).array].every(value => value >= 0 && value <= 1)).toBe(true)
      }
      expect(geometry.water.getAttribute('waterAround').count).toBe(geometry.water.getAttribute('position').count)
    } finally {
      geometry.dispose()
    }
    const spray = new FountainSpray
    expect(spray.count).toBe(fountain.sprayCount)
    expect(spray.frustumCulled).toBe(false)
    expect(spray.material.positionNode).not.toBeNull()
    expect(spray.material.opacityNode).not.toBeNull()
    expect(spray.material.mrtNode).toBeInstanceOf(TransparentSpriteOutputsNode)
    for (const name of ['sprayOrigin', 'sprayVelocity', 'sprayMotion', 'sprayOpacity']) {
      const attribute = spray.geometry.getAttribute(name)
      expect(attribute.count).toBe(fountain.sprayCount)
      expect([...(attribute as {array: Iterable<number>}).array].every(Number.isFinite)).toBe(true)
    }
    const motion = spray.geometry.getAttribute('sprayMotion')
    for (let i = 0; i < motion.count; i++) {
      expect(motion.getY(i)).toBeGreaterThan(0)
      expect(motion.getZ(i)).toBeGreaterThan(0)
    }
    spray.dispose()
  })
  test('droplets fall back into the fountain’s own water, each into the first pool it reaches', () => {
    const {gravity, basinInnerApothem, pools, lips} = fountain
    const droplets = fountainDroplets()
    expect(droplets).toHaveLength(fountain.sprayCount)
    const pool = (until: number) => (until === pools.upper ? lips.upper.radius : (until === pools.lower ? lips.lower.radius : basinInnerApothem))
    for (const {origin, velocity, until} of droplets) {
      expect(until).toBeLessThanOrEqual(origin[1])
      const lifetime = (velocity[1] + Math.sqrt(velocity[1] ** 2 + 2 * gravity * (origin[1] - until))) / gravity
      const landing = Math.hypot(origin[0] + velocity[0] * lifetime, origin[2] + velocity[2] * lifetime)
      expect(landing).toBeLessThan(pool(until))
    }
    // A crown drop thrown wide misses the upper bowl and lands in the lower one; thrown wider still, in the basin.
    expect(dropLanding([0, 4, 0], [0, 0, 0])).toBe(pools.upper)
    expect(dropLanding([0, 4, 0], [1.4, 0, 0])).toBe(pools.lower)
    expect(dropLanding([0, 4, 0], [2.2, 0, 0])).toBe(pools.basin)
  })
})
test('the grand entrance is finite, arched and entirely within the north wall', () => {
  const geometry = new EntranceGeometry
  try {
    const bounds = new Box3
    for (const part of [geometry.leaves, geometry.frame, geometry.metal]) {
      part.computeBoundingBox()
      bounds.union(part.boundingBox!)
      for (const attribute of Object.values(part.attributes)) {
        expect([...(attribute as {array: Iterable<number>}).array].every(Number.isFinite)).toBe(true)
      }
    }
    expect(bounds.max.x).toBeLessThan(2.2)
    expect(bounds.max.y).toBeLessThan(5.3)
    expect(bounds.max.y).toBeGreaterThan(5)
    expect(bounds.min.z).toBeGreaterThanOrEqual(0)
  } finally {
    geometry.dispose()
  }
})
