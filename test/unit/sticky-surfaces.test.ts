import type {Wall} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {BoxGeometry, Group, Mesh, PlaneGeometry, Scene, Triangle, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {readShowSticky} from '../../src/lib/placement/showSticky.ts'
import {hangingMargins, wallOffset, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import WallObstructionScan, {frameClearance, frameDepth} from '../../src/lib/placement/WallObstructionScan.ts'
import {patchGeometry, reservationGeometry, stickySurfaceGeometry} from '../../src/lib/placement/wallOverlayGeometry.ts'

const wall = (overrides: Partial<Wall> = {}): Wall => ({
  id: 'test-north',
  room: 'test',
  center: [1, 0.5, -2],
  rotation: 0.3,
  width: 4,
  height: 3,
  ...overrides,
})
/** every triangle of the geometry, with its area and its normal, as precise as its 32-bit positions */
const triangles = (walls: ReadonlyArray<Wall>, build = stickySurfaceGeometry) => {
  const geometry = build(walls)
  const position = geometry.getAttribute('position')
  const index = geometry.index!
  return Array.from({length: index.count / 3}, (_, face) => {
    const corner = (offset: number) => {
      const point = new Vector3
      return point.fromBufferAttribute(position, index.getX(face * 3 + offset))
    }
    const triangle = new Triangle(corner(0), corner(1), corner(2))
    return {
      triangle,
      area: triangle.getArea(),
      normal: triangle.getNormal(new Vector3),
    }
  })
}
const area = (walls: ReadonlyArray<Wall>, build = stickySurfaceGeometry) => triangles(walls, build).reduce((sum, {area: part}) => sum + part, 0)
/** A box `depth` meters deep standing out of the wall from its plaster, `width` × `height` around `u` and `y` over its foot. */
const relief = (target: Wall, u: number, y: number, width: number, height: number, depth: number) => {
  const box = new Mesh(new BoxGeometry(width, height, depth))
  box.position.set(...wallPosition(target, u, target.center[1] + y, wallFace + depth / 2))
  box.rotation.y = target.rotation
  return box
}
/** the patches one full scan of the walls in the scene finds, by wall id */
const scan = (walls: ReadonlyArray<Wall>, scene: Scene) => {
  const wallScan = new WallObstructionScan(walls, scene)
  for (const _ of wallScan.pass()) {
    // Scans to the end.
  }
  return wallScan
}
const patchArea = (patches: ReadonlyArray<{
  bottom: number
  from: number
  to: number
  top: number
}> = []) => patches.reduce((sum, {from, to, bottom, top}) => sum + (to - from) * (top - bottom), 0)
describe('?show_sticky', () => {
  test('is enabled by a bare or true flag only', () => {
    expect(readShowSticky('?show_sticky')).toBe(true)
    expect(readShowSticky('?show_sticky=true')).toBe(true)
    for (const search of ['', '?show_sticky=false', '?show_sticky=1', '?show_sticky=TRUE', '?sticky=true']) {
      expect(readShowSticky(search)).toBe(false)
    }
  })
  test('covers a whole sticky wall, facing out of it, just in front of its plaster', () => {
    const target = wall()
    expect(area([target])).toBeCloseTo(12, 5)
    for (const {triangle, normal} of triangles([target])) {
      expect(normal.x).toBeCloseTo(Math.sin(target.rotation), 5)
      expect(normal.z).toBeCloseTo(Math.cos(target.rotation), 5)
      expect(wallOffset(target, triangle.a.toArray())).toBeGreaterThan(wallFace)
      expect(wallOffset(target, triangle.a.toArray())).toBeLessThan(wallFace + 0.02)
      for (const corner of [triangle.a, triangle.b, triangle.c]) {
        expect(corner.y).toBeGreaterThanOrEqual(target.center[1] - 1e-9)
        expect(corner.y).toBeLessThanOrEqual(target.center[1] + target.height + 1e-9)
      }
    }
  })
  test('leaves out walls that are not sticky', () => {
    expect(triangles([wall({sticky: false})])).toHaveLength(0)
    expect(area([wall({sticky: false}), wall({
      id: 'test-south',
      rotation: Math.PI,
    })])).toBeCloseTo(12, 5)
  })
  test('leaves out openings and reservations', () => {
    expect(area([wall({holes: [{
      u: 0.5,
      width: 1,
      height: 2,
      profile: 'rectangle',
    }]})])).toBeCloseTo(10, 5)
    expect(area([wall({holes: [{
      u: -1,
      width: 0.6,
      bottom: 1,
      height: 1.6,
      profile: 'round',
    }]})])).toBeCloseTo(12 - Math.PI * 0.09, 2)
    expect(area([wall({reservations: [{
      u: 1,
      width: 0.2,
      bottom: 1,
      height: 1.3,
      profile: 'rectangle',
      reason: 'lightSwitch',
    }]})])).toBeCloseTo(12 - 0.06, 5)
    // A semicircular arch, springing at 1.8 m.
    expect(area([wall({holes: [{
      u: 0,
      width: 1.2,
      height: 2.4,
      profile: 'arch',
    }]})])).toBeCloseTo(12 - 1.2 * 1.8 - Math.PI * 0.36 / 2, 2)
  })
  test('cuts an opening reaching past the wall’s top off there', () => {
    expect(area([wall({holes: [{
      u: 0,
      width: 2,
      height: 4,
      profile: 'rectangle',
    }]})])).toBeCloseTo(6, 5)
  })
  test('rakes along a sloping wall', () => {
    const target = wall({
      rotation: 0,
      slope: 0.5,
    })
    expect(area([target])).toBeCloseTo(12, 5)
    const lowest = Math.min(...triangles([target]).flatMap(({triangle}) => [triangle.a, triangle.b, triangle.c].filter(corner => corner.x < target.center[0] - 1.99).map(corner => corner.y)))
    expect(lowest).toBeCloseTo(target.center[1] - 1, 5)
  })
  test('bends round a curved wall, facing out of it', () => {
    const target = wall({curveRadius: 3})
    const offset = wallFace + 0.01
    // The face lies on a circle `offset` closer to the bend’s axis, so it spans that much less of the arc.
    expect(area([target])).toBeCloseTo(4 * (3 - offset) / 3 * 3, 2)
    for (const {triangle} of triangles([target])) {
      for (const corner of [triangle.a, triangle.b, triangle.c]) {
        expect(wallOffset(target, corner.toArray())).toBeCloseTo(offset, 5)
      }
    }
  })
  test('covers exactly the declared reservations, on any wall, cut off at the wall’s top', () => {
    expect(triangles([wall()], reservationGeometry)).toHaveLength(0)
    expect(area([wall({reservations: [{
      u: 1,
      width: 0.2,
      bottom: 1,
      height: 1.3,
      profile: 'rectangle',
    }]})], reservationGeometry)).toBeCloseTo(0.06, 5)
    expect(area([wall({
      sticky: false,
      reservations: [{
        u: 0,
        width: 1.2,
        height: 2.4,
        profile: 'arch',
      }, {
        u: -1.5,
        width: 0.4,
        bottom: 2,
        height: 4,
        profile: 'rectangle',
      }],
    })], reservationGeometry)).toBeCloseTo(1.2 * 1.8 + Math.PI * 0.36 / 2 + 0.4, 2)
  })
  test('splits what is drawn toward the camera into cells of at most 20 cm', () => {
    const target = wall({rotation: 0})
    const geometry = patchGeometry([[target, [{
      from: -1,
      to: 1,
      bottom: 0.5,
      top: 2.5,
    }]]])
    expect(geometry.index!.count / 6).toBe(10)
    expect(area([target], () => geometry)).toBeCloseTo(4, 5)
    const points = geometry.getAttribute('wallPoint')
    expect([points.getX(0), points.getY(0)]).toEqual([-1, 0.5])
    // Out of the wall into its room, unit length, round curved walls too.
    const curved = wall({curveRadius: 3})
    const bent = patchGeometry([[curved, [{
      from: 1,
      to: 1.2,
      bottom: 1,
      top: 1.2,
    }]]])
    const normals = bent.getAttribute('wallNormal')
    const position = bent.getAttribute('position')
    for (let index = 0; index < normals.count; index++) {
      const point = new Vector3(position.getX(index), position.getY(index), position.getZ(index))
      const normal = new Vector3(normals.getX(index), normals.getY(index), normals.getZ(index))
      expect(normal.length()).toBeCloseTo(1, 5)
      expect(wallOffset(curved, point.clone().add(normal.multiplyScalar(0.5)).toArray()) - wallOffset(curved, point.toArray())).toBeCloseTo(0.5, 4)
    }
  })
  test('finds whatever stands out of a sticky wall in the way of hung frames, but not its own architecture, flat relief, hung works or what stands clear', () => {
    const target = wall()
    const scene = new Scene
    // A rail standing out 4.5 cm along the wall, like the Salon’s, and a dado panel of 1.2 cm under it, which a frame’s back clears.
    scene.add(relief(target, 0, 0.85, 4, 0.07, 0.045), relief(target, 0, 0.65, 4, 0.3, 0.012))
    // A lamp standing well clear of the wall, in front of where frames hang.
    const lamp = new Mesh(new BoxGeometry(0.3, 0.3, 0.3))
    lamp.position.set(...wallPosition(target, 1, target.center[1] + 2, frameDepth + 0.3))
    // The wall’s own trim and a hung work, which belong there.
    const trim = relief(target, 0, 1.5, 4, 0.1, 0.1)
    trim.name = `trim-${target.id}`
    const work = new Group
    work.userData.pickup = true
    work.add(relief(target, -1, 1.8, 0.6, 0.6, 0.15))
    scene.add(lamp, trim, work)
    const {patches} = scan([target, wall({
      id: 'test-glass',
      sticky: false,
    })], scene)
    expect(patches.keys().toArray()).toEqual([target.id])
    const found = patches.get(target.id)!
    for (const patch of found) {
      expect(patch.bottom).toBeGreaterThanOrEqual(0.8)
      expect(patch.top).toBeLessThanOrEqual(0.9 + 1e-9)
      expect(Math.abs(patch.from)).toBeLessThanOrEqual(target.width / 2 - hangingMargins.side + 1e-9)
    }
    // One 5 cm row of rays meets the 7 cm rail in every column.
    expect(found).toHaveLength(Math.floor((target.width - hangingMargins.side * 2) / 0.05))
    expect(patchArea(found)).toBeCloseTo((target.width - hangingMargins.side * 2) * 0.05, 2)
  })
  test('finds a solid set into the wall that stands out past where hung frames reach, like a chimney breast, but not one standing clear in front of the wall', () => {
    const target = wall()
    const scene = new Scene
    const breast = new Mesh(new BoxGeometry(1, 1, 0.9))
    breast.position.set(...wallPosition(target, -0.5, target.center[1] + 1.5, wallFace - 0.05 + 0.45))
    breast.rotation.y = target.rotation
    const bench = new Mesh(new BoxGeometry(1, 0.5, 0.5))
    bench.position.set(...wallPosition(target, 1, target.center[1] + 1.5, frameDepth + 0.3))
    bench.rotation.y = target.rotation
    // An open surface standing out in the room, facing away from the wall, which the ray out of the wall meets from behind, merged with a knob on the wall, so it is cast against.
    const panel = new PlaneGeometry(1, 1)
    const knob = new BoxGeometry(0.1, 0.1, 0.1)
    const screen = new Mesh(mergeGeometries([panel.translate(1.2, 1.7, 1), knob.translate(-1.5, 0.75, wallFace + 0.05)]))
    screen.position.set(...wallPosition(target, 0, target.center[1], 0))
    screen.rotation.y = target.rotation
    scene.add(breast, bench, screen)
    const found = scan([target], scene).patches.get(target.id)!
    // The breast’s square meter and the knob’s 2 × 2 rays.
    expect(patchArea(found)).toBeCloseTo(1.01, 2)
    for (const patch of found) {
      expect(patch.to).toBeLessThanOrEqual(0 + 1e-9)
    }
  })
  test('leaves out the margins of openings and reservations', () => {
    const target = wall({reservations: [{
      u: 0,
      width: 1,
      bottom: 0.5,
      height: 1.5,
      profile: 'rectangle',
    }]})
    const scene = new Scene
    scene.add(relief(target, 0, 1, 4, 1, 0.3))
    const found = scan([target], scene).patches.get(target.id)!
    expect(found.length).toBeGreaterThan(0)
    for (const patch of found) {
      expect(Math.abs((patch.from + patch.to) / 2)).toBeGreaterThan(0.5 + hangingMargins.cutout)
    }
  })
  test('looks between a hung frame’s back and front', () => {
    expect(frameClearance).toBeCloseTo(wallFace + 0.02, 9)
    expect(frameDepth).toBeGreaterThan(frameClearance)
  })
})
