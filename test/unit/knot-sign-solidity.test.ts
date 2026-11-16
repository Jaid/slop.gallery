import {expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {billboardParts, knotSign, knotSignParts, knotSignPosition, knotSignRoundParts} from 'knot-materials/signs.ts'
import {BoxGeometry, Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import createSupportGeometry from '../../src/components/KnotLabels/supportGeometry.ts'
import {circleSegments, triangleCount} from '../../src/lib/geometry.ts'

await RAPIER.init()
for (const [title, parts, elevation] of [
  ['nameplate', knotSignParts, knotSign.elevation],
  ['wide billboard', billboardParts(4.8, 2.4), 1.5],
  ['tall billboard', billboardParts(2.75, 2.75), 1.5],
] as const) {
  test(`${title} has grounded supports and matching solid cuboids`, () => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    const material = new MeshBasicMaterial
    const meshes: Array<Mesh> = []
    try {
      for (const {position, rotation = [0, 0, 0], size} of parts) {
        expect(size.every(value => value > 0)).toBe(true)
        const mesh = new Mesh(new BoxGeometry(...size), material)
        mesh.position.set(...position)
        mesh.rotation.set(rotation[0], rotation[1], rotation[2])
        mesh.updateMatrixWorld()
        meshes.push(mesh)
        const cuboidRotation = new Quaternion
        world.createCollider(RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...position).setRotation(cuboidRotation.setFromEuler(new Euler(...rotation))))
      }
      if (title === 'nameplate') {
        // The rendered, instanced stand geometry, not a separately tessellated stand-in.
        const stand = new Mesh(createSupportGeometry(), material)
        stand.updateMatrixWorld()
        meshes.push(stand)
        for (const {position, rotation = [0, 0, 0], radius, height} of knotSignRoundParts) {
          const roundPartRotation = new Quaternion
          world.createCollider(RAPIER.ColliderDesc.cylinder(height / 2, radius).setTranslation(...position).setRotation(roundPartRotation.setFromEuler(new Euler(...rotation))))
        }
        expect(Math.min(...knotSignRoundParts.map(part => part.position[1] - part.height / 2)) + elevation).toBeCloseTo(0, 6)
      } else {
        expect(Math.min(...parts.filter(part => !part.rotation).map(part => part.position[1] - part.size[1] / 2)) + elevation).toBeCloseTo(0, 6)
      }
      const face = new Vector3(0, 0, parts[0].size[2] / 2)
      face.applyEuler(new Euler(...parts[0].rotation ?? [0, 0, 0])).add(new Vector3(...parts[0].position))
      expect(face.length()).toBeCloseTo(0, 6)
      expect(parts[0].size[2]).toBeLessThanOrEqual(0.05)
      world.step()
      for (const side of [-1, 1]) {
        for (const part of title === 'nameplate' ? [...parts, ...knotSignRoundParts] : parts) {
          const origin = new Vector3(part.position[0], part.position[1], side * 2)
          const direction = new Vector3(0, 0, -side)
          const sightRay = new Raycaster(origin, direction)
          const visible = sightRay.intersectObjects(meshes)[0]
          const hit = world.castRay(new RAPIER.Ray(origin, direction), 4, true)
          expect(visible).toBeDefined()
          expect(hit).not.toBeNull()
          expect(hit!.timeOfImpact).toBeCloseTo(visible.distance, 5)
        }
      }
    } finally {
      world.free()
      material.dispose()
      for (const mesh of meshes) {
        mesh.geometry.dispose()
      }
    }
  })
}
test('nameplates stay diagonally beside rotated exhibits', () => {
  for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const position = knotSignPosition({
      position: [3, 0, 5],
      rotation,
    })
    expect(position[0]).toBeCloseTo(3 + Math.cos(rotation) * knotSign.sideOffset + Math.sin(rotation) * knotSign.frontOffset)
    expect(position[1]).toBe(knotSign.elevation)
    expect(position[2]).toBeCloseTo(5 - Math.sin(rotation) * knotSign.sideOffset + Math.cos(rotation) * knotSign.frontOffset)
  }
})
test('museum stand has a slender stem, round grounded foot and upward-facing plaque', () => {
  const [stem, base, collar, boss] = knotSignRoundParts
  expect(stem.radius).toBeLessThan(0.025)
  expect(base.radius).toBeGreaterThan(stem.radius * 8)
  expect(collar.radius).toBeGreaterThan(stem.radius)
  expect(boss.radius).toBeGreaterThan(collar.radius)
  expect(boss.rotation?.[0]).toBeCloseTo(Math.PI / 2 + knotSign.tilt)
  expect(stem.position[1] - stem.height / 2 + knotSign.elevation).toBeCloseTo(0)
  expect(stem.position[1] + stem.height / 2).toBeCloseTo(0)
  const normal = new Vector3(0, 0, 1)
  normal.applyEuler(new Euler(knotSign.tilt, 0, 0))
  const collarFrontmost = new Vector3(collar.position[0], collar.position[1] + collar.height / 2, collar.position[2] + collar.radius)
  expect(normal.dot(collarFrontmost)).toBeLessThan(-knotSign.thickness)
  expect(normal.dot(new Vector3(...boss.position)) + boss.height / 2).toBeCloseTo(-knotSign.thickness)
  expect(Math.atan2(normal.y, normal.z) * 180 / Math.PI).toBeCloseTo(38)
  expect(Math.abs(knotSign.sideOffset) - knotSign.width / 2).toBeGreaterThan(0.5)
})
test('stand stays on the left with its back turned toward its knot', () => {
  expect(knotSign.sideOffset).toBeLessThan(0)
  for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const position = knotSignPosition({
      position: [0, 0, 0],
      rotation,
    })
    const towardKnot = new Vector3(-position[0], 0, -position[2])
    towardKnot.normalize()
    const back = new Vector3(0, 0, -1)
    back.applyAxisAngle(new Vector3(0, 1, 0), rotation + knotSign.inwardRotation)
    expect(back.dot(towardKnot)).toBeGreaterThan(0.8)
  }
})
test('stand parts share one half-millimeter silhouette tolerance and drop only buried stem caps', () => {
  const sag = (radius: number, segments: number) => radius * (1 - Math.cos(Math.PI / segments))
  expect(() => circleSegments(0)).toThrow(RangeError)
  expect(circleSegments(0.0001)).toBe(circleSegments(0.00001))
  for (const radius of [0.0001, 0.018, 0.2, ...knotSignRoundParts.map(part => part.radius)]) {
    const segments = circleSegments(radius)
    expect(segments % 4).toBe(0)
    expect(sag(radius, segments)).toBeLessThanOrEqual(0.0005)
    // Four fewer would show, unless it is as coarse as any circle gets.
    if (segments > circleSegments(0.00001)) {
      expect(sag(radius, segments - 4)).toBeGreaterThan(0.0005)
    }
  }
  const [stem, base, , boss] = knotSignRoundParts
  expect(knotSignRoundParts.filter(part => part.openEnded)).toEqual([stem])
  // The stem’s foot is flush with the base’s underside and its head sits inside the mounting boss.
  expect(stem.position[1] - stem.height / 2).toBeCloseTo(base.position[1] - base.height / 2, 9)
  const head = new Vector3(stem.position[0], stem.position[1] + stem.height / 2, stem.position[2])
  head.sub(new Vector3(...boss.position))
  const axis = new Vector3(0, 1, 0)
  axis.applyEuler(new Euler(...boss.rotation!))
  const along = head.dot(axis)
  expect(Math.abs(along)).toBeLessThan(boss.height / 2)
  expect(head.addScaledVector(axis, -along).length() + stem.radius).toBeLessThan(boss.radius)
  const geometry = createSupportGeometry()
  try {
    expect(triangleCount(geometry)).toBe(12 + knotSignRoundParts.reduce((sum, part) => sum + circleSegments(part.radius) * (part.openEnded ? 2 : 4), 0))
    expect(triangleCount(geometry)).toBeLessThan(500)
  } finally {
    geometry.dispose()
  }
})
