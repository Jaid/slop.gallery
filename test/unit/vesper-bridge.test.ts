import {afterAll, describe, expect, test} from 'bun:test'

import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {middaySun} from '../../src/lib/gallery/sun.ts'
import VesperBridgeGeometry, {arcHeight, arcThrough, inscribedCircle, vesperBridgeCollision, vesperBridgeLayout} from '../../src/lib/gallery/VesperBridgeGeometry.ts'
import vesperCeiling, {vesperCoveTopY, vesperLanternEavesY, vesperLanternHalf, vesperLanternRidgeY, vesperLanternSillY} from '../../src/lib/gallery/vesperCeiling.ts'
import VesperCeilingGeometry from '../../src/lib/gallery/VesperCeilingGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {rooms} from './fixtures/gallery.ts'

const room = rooms.find(candidate => candidate.id === 'vesper')!
const [halfX, halfZ] = vesperLanternHalf(room.size)
const {bridge, gilt, lantern} = vesperCeiling
const layout = vesperBridgeLayout(room.size)
const geometry = new VesperBridgeGeometry(room.size)
const ceiling = new VesperCeilingGeometry(room.size)
const material = new MeshBasicMaterial({side: DoubleSide})
afterAll(() => {
  geometry.dispose()
  ceiling.dispose()
  material.dispose()
})
const parts = () => [geometry.bronze, geometry.gilt]
const vertices = (part: BufferGeometry) => {
  const position = part.getAttribute('position')
  return Array.from({length: position.count}, (_, index) => new Vector3(position.getX(index), position.getY(index), position.getZ(index)))
}
/** height of the lantern’s hipped roof over the point on the plan */
const roofY = (x: number, z: number) => vesperLanternEavesY + lantern.rise * Math.min(halfX - Math.abs(x), halfZ - Math.abs(z)) / halfX
const meshes = (geometries: ReadonlyArray<BufferGeometry>) => geometries.map(part => {
  const mesh = new Mesh(part, material)
  part.boundsTree = new MeshBVH(part)
  mesh.raycast = acceleratedRaycast
  mesh.updateMatrixWorld()
  return mesh
})
describe('the arcs of the Vesper’s bridge', () => {
  test('a circle through two mirrored points peaks at its crown', () => {
    const arc = arcThrough(2, 1, 1.5)
    expect(arcHeight(arc, 0)).toBeCloseTo(1.5, 12)
    expect(arcHeight(arc, 2)).toBeCloseTo(1, 12)
    expect(arcHeight(arc, -2)).toBeCloseTo(1, 12)
    expect(() => arcThrough(2, 1, 1)).toThrow(RangeError)
  })
  test('an inscribed circle touches the arc below it and the arc above it', () => {
    const below = arcThrough(3, 0, 0.6)
    const above = arcThrough(3, 0.5, 0.9)
    for (const x of [0, 0.7, 1.9, 2.6]) {
      const {radius, x: at, y} = inscribedCircle(below, above, x)
      expect(at).toBe(x)
      expect(radius).toBeGreaterThan(0)
      expect(Math.hypot(at, y - below.center) - below.radius).toBeCloseTo(radius, 9)
      expect(above.radius - Math.hypot(at, y - above.center)).toBeCloseTo(radius, 9)
    }
  })
})
describe('the Vesper’s bridge', () => {
  test('spans the lantern across its middle, square to its ridge', () => {
    for (const part of parts()) {
      part.computeBoundingBox()
      const {min, max} = part.boundingBox!
      // Symmetric about both axes, so it splits the lantern into two equal halves.
      expect(min.x).toBeCloseTo(-max.x, 4)
      expect(min.z).toBeCloseTo(-max.z, 4)
      expect(Math.max(-min.x, max.x)).toBeLessThanOrEqual(halfX + 1e-5)
      // Far narrower than the lantern is long, which leaves two halves of glass on both sides.
      expect(max.z).toBeLessThan(halfZ / 8)
    }
    // From one long side to the other.
    expect(geometry.bronze.boundingBox!.max.x).toBeCloseTo(halfX, 4)
  })
  test('stays inside the lantern’s glass and below its roof, clear of the glass by the bars’ own gap', () => {
    for (const part of parts()) {
      for (const {x, y, z} of vertices(part)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(halfX + 1e-5)
        expect(y).toBeLessThanOrEqual(roofY(x, z) - lantern.gap + 1e-4)
        expect(y).toBeLessThanOrEqual(vesperLanternRidgeY)
      }
    }
  })
  test('springs from the gilt fillets along the opening and hangs no lower', () => {
    expect(layout.springY).toBeCloseTo(vesperCoveTopY + gilt.fillet, 9)
    expect(arcHeight(layout.arch, halfX)).toBeCloseTo(layout.springY, 9)
    for (const part of parts()) {
      for (const {y} of vertices(part)) {
        expect(y).toBeGreaterThanOrEqual(vesperCoveTopY - 1e-5)
      }
    }
  })
  test('carries a cambered deck, its arch rising beneath it and its railings within reach of the roof', () => {
    const {arch, deck, deckEnd, extrados, girderBottom} = layout
    expect(arcHeight(deck, 0)).toBeCloseTo(vesperLanternSillY + bridge.deck[1], 9)
    expect(arcHeight(deck, deckEnd)).toBeCloseTo(vesperLanternSillY + bridge.deck[0], 9)
    expect(arcHeight(extrados, 0)).toBeCloseTo(arcHeight(girderBottom, 0) - bridge.crownGap, 9)
    expect(arch.radius).toBeGreaterThan(deckEnd)
    // The handrails clear the roof’s slopes with room to spare, also where they meet the pylons.
    const handrail = (x: number) => arcHeight(deck, Math.min(Math.abs(x), deckEnd)) + bridge.railing.height + bridge.railing.handrail
    for (const x of [0, deckEnd / 2, deckEnd]) {
      expect(roofY(x, bridge.halfWidth)).toBeGreaterThan(handrail(x) + 0.05)
    }
  })
  test('sets rings into its spandrels that rest on the arch, touch the girders and keep even gaps toward the medallion at the crown', () => {
    const {deckEnd, extrados, girderBottom, medallion, rings} = layout
    expect(rings.length).toBeGreaterThanOrEqual(6)
    for (const ring of rings) {
      expect(Math.hypot(ring.x, ring.y - extrados.center) - extrados.radius).toBeCloseTo(ring.radius, 6)
      expect(girderBottom.radius - Math.hypot(ring.x, ring.y - girderBottom.center)).toBeCloseTo(ring.radius, 6)
    }
    // Shrinking toward the crown as the spandrel narrows.
    for (let index = 1; index < rings.length; index++) {
      expect(rings[index].x).toBeLessThan(rings[index - 1].x)
      expect(rings[index].radius).toBeLessThan(rings[index - 1].radius)
    }
    const gaps = rings.slice(1).map((ring, index) => Math.hypot(ring.x - rings[index].x, ring.y - rings[index].y) - ring.radius - rings[index].radius)
    const spacing = deckEnd - rings[0].x - rings[0].radius
    expect(spacing).toBeGreaterThanOrEqual(bridge.rings.gap - 1e-9)
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(spacing, 6)
    }
    const last = rings.at(-1)!
    expect(Math.hypot(last.x - medallion.x, last.y - medallion.y) - last.radius - medallion.radius).toBeCloseTo(spacing * bridge.rings.medallionGaps, 6)
    // The medallion is the largest of them, breaking over the girders and the arch.
    expect(medallion.x).toBe(0)
    expect(medallion.radius).toBeGreaterThan(rings[0].radius * 0.8)
    expect(medallion.y + medallion.radius).toBeGreaterThan(arcHeight(girderBottom, 0))
    expect(medallion.y - medallion.radius).toBeLessThan(arcHeight(extrados, 0))
  })
  test('railing posts line up with the ties under the deck, evenly between the pylons', () => {
    const {deckEnd, posts} = layout
    expect(posts).toHaveLength(bridge.railing.bays - 1)
    const bay = deckEnd * 2 / bridge.railing.bays
    for (const [index, x] of posts.entries()) {
      expect(x).toBeCloseTo(-deckEnd + (index + 1) * bay, 9)
    }
    expect(posts[(posts.length - 1) / 2]).toBeCloseTo(0, 9)
  })
  test('keeps a modest triangle budget at both detail levels', () => {
    const count = (bridgeGeometry: VesperBridgeGeometry) => triangleCount(bridgeGeometry.bronze) + triangleCount(bridgeGeometry.gilt)
    expect(count(geometry)).toBeLessThan(20_000)
    const detailed = new VesperBridgeGeometry(room.size, 2)
    try {
      expect(count(detailed)).toBeGreaterThan(count(geometry))
      expect(count(detailed)).toBeLessThan(40_000)
    } finally {
      detailed.dispose()
    }
  })
  test('still lets the sun into both halves of the room, and casts its shadow between them', () => {
    const opaque = meshes([ceiling.plaster, ceiling.gilt, ceiling.bars])
    const [glass] = meshes([ceiling.glass])
    const [shade] = meshes([geometry.bronze, geometry.gilt])
    const direction = new Vector3(...middaySun)
    const raycaster = new Raycaster
    raycaster.firstHitOnly = true
    const lit = {
      north: 0,
      south: 0,
    }
    let shaded = 0
    const [faceX, faceZ] = room.size.map(size => size / 2 - 0.2)
    for (let x = -faceX; x <= faceX; x += 0.25) {
      for (let z = -faceZ; z <= faceZ; z += 0.25) {
        raycaster.set(new Vector3(x, 0.1, z), direction)
        const pane = raycaster.intersectObject(glass, false).at(0)
        const blocked = raycaster.intersectObjects(opaque, false).at(0)
        if (!pane || blocked && blocked.distance < pane.distance) {
          continue
        }
        if (raycaster.intersectObject(shade, false).at(0)) {
          shaded++
          continue
        }
        // The half of the lantern the sun shines in through.
        lit[pane.point.z < 0 ? 'north' : 'south']++
      }
    }
    expect(shaded).toBeGreaterThan(0)
    expect(lit.north).toBeGreaterThan(shaded)
    expect(lit.south).toBeGreaterThan(shaded)
  })
  test('a solid collision surface lines its soffit, deck and railings, stopping at the glass', () => {
    const [positions, indices] = vesperBridgeCollision(room.size)
    expect(indices.length % 3).toBe(0)
    expect(indices.length).toBeGreaterThan(0)
    for (let index = 0; index < positions.length; index += 3) {
      expect(Math.abs(positions[index])).toBeLessThan(halfX)
      expect(positions[index + 1]).toBeGreaterThanOrEqual(layout.springY - 1e-5)
      expect(Math.abs(positions[index + 2])).toBeLessThanOrEqual(bridge.halfWidth + 1e-5)
    }
    const surface = new BufferGeometry
    surface.setAttribute('position', new BufferAttribute(positions, 3))
    surface.setIndex(new BufferAttribute(indices, 1))
    const [collider] = meshes([surface])
    const raycaster = new Raycaster
    const down = new Vector3(0, -1, 0)
    try {
      for (const x of [0, 1, -2, layout.deckEnd - 0.05]) {
        // What drops onto the deck lands on it, a little under the girders’ top, and what flies up from below meets the soffit.
        raycaster.set(new Vector3(x, vesperLanternRidgeY, 0), down)
        const landing = raycaster.intersectObject(collider, false).at(0)
        expect(Math.abs(landing!.point.y - (arcHeight(layout.deck, Math.min(Math.abs(x), layout.deckEnd)) - bridge.plate[0]))).toBeLessThan(0.002)
        raycaster.set(new Vector3(x, 1, 0), down.clone().negate())
        const soffit = raycaster.intersectObject(collider, false).at(0)
        expect(Math.abs(soffit!.point.y - arcHeight(layout.arch, x))).toBeLessThan(0.002)
        // The railings keep it from rolling off either side.
        for (const side of [-1, 1]) {
          raycaster.set(new Vector3(x, arcHeight(layout.deck, Math.min(Math.abs(x), layout.deckEnd)) + 0.2, 0), new Vector3(0, 0, side))
          const railing = raycaster.intersectObject(collider, false).at(0)
          expect(railing?.distance).toBeCloseTo(layout.railingZ - 0.012, 4)
        }
      }
    } finally {
      surface.dispose()
    }
  })
})
