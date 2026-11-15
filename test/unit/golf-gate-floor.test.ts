import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {baseboardCapFront, defaultBaseboardHeight, wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionLink, bastionLinkGate, climbMouthHollow} from '../../src/lib/gallery/bastionNetwork.ts'
import FloorHollow from '../../src/lib/gallery/passages/FloorHollow.ts'
import pavingColumns from '../../src/lib/gallery/passages/pavingColumns.ts'
import RouteVaultGeometry, {pavingThickness} from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import {floorHeight} from './fixtures/gallery.ts'
import {addOrb, bastionColliders, physicsWorld} from './helpers/bastionWorld.ts'

await RAPIER.init()
const {route} = bastionLink
const [gateX, gateZ] = route.end.point
const half = bastionLink.width / 2
const material = new MeshBasicMaterial
const vault = new RouteVaultGeometry(bastionLink)
const hollow = climbMouthHollow.geometry()
const meshes = [vault.paving, hollow].map(geometry => {
  geometry.boundsTree = new MeshBVH(geometry)
  const mesh = new Mesh(geometry, material)
  mesh.raycast = acceleratedRaycast
  return mesh
})
const down = new Raycaster(new Vector3, new Vector3(0, -1, 0))
down.firstHitOnly = true
const cast = (mesh: Mesh, x: number, z: number) => {
  down.ray.origin.set(x, 0, z)
  return down.intersectObject(mesh).at(0)
}
afterAll(() => {
  vault.dispose()
  hollow.dispose()
  material.dispose()
})
test('the gate’s bowed seam matches on both sides, not only under its hatch', () => {
  expect(bastionLink.floorOutlet).toBeDefined()
  for (let x = gateX - half + 0.001; x < gateX + half; x += 0.017) {
    const southY = climbMouthHollow.floorAt(x, gateZ)!
    expect(bastionLink.floorAt(x, gateZ)).toBeCloseTo(southY, 9)
    const north = cast(meshes[0], x, gateZ - 0.00001)!
    const south = cast(meshes[1], x, gateZ + 0.00001)!
    expect(north.point.y).toBeCloseTo(south.point.y, 5)
    expect(north.face!.normal.dot(south.face!.normal)).toBeGreaterThan(0.998)
  }
  // Same sampled knots on either side, with identical Float32 heights: no straight chord shortcuts across the bow.
  const south = hollow.getAttribute('position')
  const north = vault.paving.getAttribute('position')
  for (let i = 0; i < south.count; i++) {
    if (Math.abs(south.getZ(i) - gateZ) > 1e-6 || Math.abs(south.getX(i) - gateX) > half - 0.001) {
      continue
    }
    expect(Array.from({length: north.count}, (_, j) => j).some(j => north.getX(j) === south.getX(i) && north.getY(j) === south.getY(i) && north.getZ(j) === south.getZ(i))).toBe(true)
  }
  expect(bastionLink.floorAt(gateX - half, gateZ)).toBeCloseTo(climbMouthHollow.floorAt(gateX - half, gateZ)!, 9)
  expect(bastionLink.floorAt(gateX + half, gateZ)).toBeCloseTo(climbMouthHollow.floorAt(gateX + half, gateZ)!, 9)
})
test('the bow spills north and around the inside corner, then returns to the ordinary tunnel floor', () => {
  const floor = bastionLink.floorOutlet!
  const patch = floor.outlet
  expect(patch.reach).toBe(1.5)
  // At the inner jamb there is only 12.5 cm of turn radius. The shaping must spill into the preceding straight, not become a steep lip round that little post.
  const turn = route.pieces.at(-1)!
  const upstream = route.at(turn.from - 0.5)
  expect(bastionLink.floorY(upstream, -half + wallFace)).toBeGreaterThan(upstream.y - bastionLink.sag(upstream, -half + wallFace) + 0.1)
  for (let along = 0; along < floor.from; along += 0.117) {
    const station = route.at(along)
    for (const right of [-half, -1, 0, 1, half]) {
      expect(bastionLink.floorY(station, right)).toBeCloseTo(station.y - bastionLink.sag(station, right), 12)
    }
  }
  for (const right of pavingColumns(bastionLink.width)) {
    expect(bastionLink.floorY(route.at(floor.from), right)).toBeCloseTo(route.at(floor.from).y - bastionLink.sag(route.at(floor.from), right), 9)
  }
})
test('visible paving, collision and floor queries share the same triangles throughout the curved blend and southern hollow', () => {
  expect(vault.pavingCollision).toBe(vault.paving)
  expect(colliderGeometry(vault.pavingCollision)).toEqual(colliderGeometry(vault.paving))
  for (let along = bastionLink.floorOutlet!.from + 0.013; along < route.length; along += 0.097) {
    const station = route.at(along)
    for (let right = -half + 0.015; right < half - 0.01; right += 0.151) {
      const x = station.point[0] - Math.sin(station.heading) * right
      const z = station.point[1] + Math.cos(station.heading) * right
      const hit = cast(meshes[0], x, z)!
      expect(hit).toBeDefined()
      expect(hit.point.y).toBeCloseTo(bastionLink.floorAt(x, z)!, 5)
      expect(floorHeight([x, hit.point.y + 1.6, z])).toBeCloseTo(hit.point.y, 5)
      // Neither a vertical slice nor a disguised near-vertical ramp.
      expect(hit.face!.normal.y).toBeGreaterThan(0.85)
    }
  }
  for (let x = gateX - 1.7; x < gateX + 1.7; x += 0.129) {
    for (let z = gateZ + 0.013; z < gateZ + 3; z += 0.157) {
      const hit = cast(meshes[1], x, z)!
      expect(hit.point.y).toBeCloseTo(climbMouthHollow.floorAt(x, z)!, 6)
      expect(floorHeight([x, hit.point.y + 1.6, z])).toBeCloseTo(hit.point.y, 6)
    }
  }
})
test('the reshaped slab retains its full vertical thickness, with no drop face left across the south seam', () => {
  const up = new Raycaster(new Vector3, new Vector3(0, 1, 0))
  for (let x = gateX - half + 0.01; x < gateX + half; x += 0.163) {
    for (let z = gateZ - 1.3; z < gateZ; z += 0.139) {
      const top = cast(meshes[0], x, z)
      if (!top) {
        continue
      }
      up.ray.origin.set(x, -7, z)
      expect(up.intersectObject(meshes[0])[0].point.y).toBeCloseTo(top.point.y - pavingThickness, 5)
    }
  }
  const normal = hollow.getAttribute('normal')
  for (let i = 0; i < normal.count; i++) {
    expect(normal.getY(i)).toBeGreaterThan(0.9)
  }
})
test('both tunnel baseboards follow the blend through their profiles, while the gate and hatch stay put', () => {
  for (const wall of bastionLink.walls.slice(-4)) {
    for (const [u, rise] of wall.baseboardProfile!) {
      const [x, , z] = wallPosition(wall, u, 0, 0)
      expect(wall.center[1] + rise).toBeCloseTo(bastionLink.floorAt(x, z)!, 7)
    }
  }
  expect(bastionLinkGate.wall.center[2]).toBe(gateZ)
  expect(bastionLinkGate.wall.center[1] + bastionLinkGate.hatch.bottom!).toBe(route.end.y)
  // Space for the 28 cm orb remains under the hatch’s 50 cm crown.
  expect(bastionLinkGate.wall.center[1] + bastionLinkGate.hatch.height - bastionLink.floorAt(gateX, gateZ)!).toBeGreaterThan(0.45)
})
test('the rendered baseboard caps follow the reshaped floor around both sides of the turn', () => {
  for (const wall of bastionLink.walls.slice(-4)) {
    const architecture = createArchitectureGeometry(wall)
    const trim = architecture.trim.map(geometry => {
      const mesh = new Mesh(geometry, material)
      mesh.position.set(...wall.center)
      mesh.rotation.y = wall.rotation
      mesh.updateMatrixWorld(true)
      return mesh
    })
    try {
      for (let u = -wall.width / 2 + 0.02; u < wall.width / 2 - 0.02; u += 0.071) {
        const [x, , z] = wallPosition(wall, u, 0, baseboardCapFront - 0.01)
        const [px, , pz] = wallPosition(wall, u, 0, 0)
        if (bastionLink.stationAt(px, pz)!.along < bastionLink.floorOutlet!.from) {
          continue
        }
        down.ray.origin.set(x, 0, z)
        const top = down.intersectObjects(trim)[0]
        expect(top, `${wall.id} at ${u}`).toBeDefined()
        // Bending and retriangulating a curved cap introduces submillimeter differences between its facets and its centerline profile.
        expect(Math.abs(top.point.y - bastionLink.floorAt(px, pz)! - (wall.baseboardHeight ?? defaultBaseboardHeight))).toBeLessThan(0.001)
      }
    } finally {
      architecture.dispose()
    }
  }
})
const colliders = bastionColliders()
for (const offset of [-0.8, 0, 0.8]) {
  test(`an orb drains through the gate onto the blended north floor, starting ${offset} m off center`, () => {
    const world = physicsWorld(colliders)
    const x = gateX + offset
    const z = gateZ + 1.6
    const body = addOrb(world, [x, climbMouthHollow.floorAt(x, z)! + 0.142, z])
    try {
      let crossed = false
      for (let frame = 0; frame < 60 * 30; frame++) {
        world.step()
        const position = body.translation()
        if (position.z < gateZ - 0.3) {
          crossed = true
          break
        }
      }
      expect(crossed).toBe(true)
    } finally {
      world.free()
    }
  })
}
test('a hollow only supplies an outlet profile along its real surface boundary', () => {
  for (const width of [0, -1, NaN, Infinity, 5]) {
    expect(() => climbMouthHollow.outletProfile(width)).toThrow(RangeError)
  }
  const larger = new FloorHollow(climbMouthHollow.y, climbMouthHollow.outlet, climbMouthHollow.shape, {
    area: {
      ...climbMouthHollow.footprint,
      size: [4, 6],
    },
  })
  expect(() => larger.outletProfile(1)).toThrow(RangeError)
})
