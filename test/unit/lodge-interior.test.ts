import type {NodeMaterial} from 'three/webgpu'

import {afterAll, describe, expect, test} from 'bun:test'

import {AmbientLight, DirectionalLight, DoubleSide, HemisphereLight, Material, Mesh, MeshBasicMaterial, PointLight, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import lodge, {lodgeBay, lodgeOutline} from '../../src/lib/gallery/lodge.ts'
import lodgeInterior, {lodgeFurnitureColliders} from '../../src/lib/gallery/lodgeInterior/layout.ts'
import LodgeCeilingGeometry from '../../src/lib/gallery/lodgeInterior/LodgeCeilingGeometry.ts'
import UpholsteredSeatGeometry from '../../src/lib/gallery/lodgeInterior/UpholsteredSeatGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {IndoorLightsNode, reachesIndoors} from '../../src/lib/materials/lights/index.ts'
import LodgeMaterials from '../../src/lib/materials/LodgeMaterials.ts'
import PlankMaterial from '../../src/lib/materials/PlankMaterial.ts'

test('every Lodge material is lit only by indoor lights and builds its surface nodes', () => {
  const materials = new LodgeMaterials
  try {
    const all = Object.values(materials).flat().filter(value => value instanceof Material)
    expect(all.length).toBeGreaterThan(0)
    const lightsNodes = new Set(all.map(material => (material as NodeMaterial).lightsNode))
    expect(lightsNodes.size).toBe(1)
    expect([...lightsNodes][0]).toBeInstanceOf(IndoorLightsNode)
    for (const material of [materials.floor, materials.ceiling, materials.logWall, materials.stone, materials.timber, materials.leather, materials.rug, materials.iron]) {
      expect(material.colorNode).not.toBeNull()
      expect(material.normalNode).not.toBeNull()
    }
    expect(materials.floor).toBeInstanceOf(PlankMaterial)
  } finally {
    materials.dispose()
  }
})
test('the gallery’s sun stays outside while lamps, fire and fill lights reach indoors', () => {
  expect(reachesIndoors(new DirectionalLight)).toBe(false)
  for (const light of [new PointLight, new AmbientLight, new HemisphereLight]) {
    expect(reachesIndoors(light)).toBe(true)
  }
})
test('furniture geometry is finite, merged per material and within its triangle budget', () => {
  const sofa = new UpholsteredSeatGeometry(3)
  const chair = new UpholsteredSeatGeometry(1, 0.76)
  try {
    const parts = [sofa.leather, sofa.timber, chair.leather, chair.timber]
    for (const geometry of parts) {
      const position = geometry.getAttribute('position')
      expect(position.count).toBeGreaterThan(0)
      expect([...position.array].every(Number.isFinite)).toBe(true)
      expect(geometry.hasAttribute('normal')).toBe(true)
    }
    const total = parts.reduce((sum, geometry) => sum + triangleCount(geometry), 0)
    expect(total).toBeLessThan(40_000)
    // The sofa’s width follows its seats, with its back below the frame height.
    expect(sofa.width).toBeCloseTo(3 * 0.68 + UpholsteredSeatGeometry.armWidth * 2)
    sofa.leather.computeBoundingBox()
    expect(sofa.leather.boundingBox!.max.y).toBeLessThanOrEqual(UpholsteredSeatGeometry.backHeight + 0.01)
    expect(sofa.leather.boundingBox!.min.y).toBeGreaterThanOrEqual(0)
  } finally {
    sofa.dispose()
    chair.dispose()
  }
})
test('furniture colliders cover every piece that stands on the floor', () => {
  const names = new Set(lodgeFurnitureColliders().map(collider => collider.name))
  for (const name of ['lodge-sofa', 'lodge-armchair-0', 'lodge-armchair-1']) {
    expect(names.has(name)).toBe(true)
  }
  // Removed furniture must not leave behind colliders.
  for (const name of ['lodge-coffee-table', 'lodge-console-table', 'lodge-fire-tools', 'lodge-firewood']) {
    expect(names.has(name)).toBe(false)
  }
  // The mantel stays bare.
  for (const key of ['candlesticks', 'books', 'firewood', 'windowSeat', 'coffeeTable']) {
    expect(key in lodgeInterior).toBe(false)
  }
  for (const {size} of lodgeFurnitureColliders()) {
    expect(size.every(value => Number.isFinite(value) && value > 0)).toBe(true)
  }
})
/** every corner of a mesh in its parent’s frame */
function corners(mesh: Mesh) {
  const position = mesh.geometry.getAttribute('position')
  return Array.from({length: position.count}, (_, i) => {
    const corner = new Vector3
    return corner.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
  })
}
/** the first surfaces straight above a point, all of those at the same height */
function surfacesAbove(meshes: Array<Mesh>, x: number, z: number, far: number) {
  const ray = new Raycaster(new Vector3(x, 0, z), new Vector3(0, 1, 0), 0, far)
  const hits = ray.intersectObjects(meshes)
  return hits.filter(hit => hit.distance - hits[0].distance < 1e-4)
}
describe('the Lodge’s ceiling beams', () => {
  const ceiling = new LodgeCeilingGeometry
  const material = new MeshBasicMaterial({side: DoubleSide})
  afterAll(() => {
    ceiling.dispose()
    material.dispose()
  })
  /** the members as meshes in the room’s frame */
  const meshes = ceiling.members.map(({geometry, name, position, yaw}) => {
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(position[0], lodge.height, position[2])
    mesh.rotation.y = yaw
    mesh.updateMatrixWorld()
    return mesh
  })
  const plan = lodgeOutline.map(([x, z]) => [x - lodge.center[0], z - lodge.center[1]] as const)
  /** how far a point lies inside the walls’ middles, the nearest wall counting */
  const inside = ({x, z}: Vector3) => Math.min(...plan.map((a, i) => {
    const b = plan[(i + 1) % plan.length]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    // The outline runs from the south-west corner north first, which turns this edge normal into the room.
    return ((x - a[0]) * (a[1] - b[1]) + (z - a[1]) * (b[0] - a[0])) / length
  }))
  test('only the crossbeams hang from the ceiling, with the header across the bay’s mouth', () => {
    const [frontWest, , , frontEast] = lodgeBay.corners
    expect(meshes.map(mesh => mesh.name)).toEqual(['lodge-beam', 'lodge-beam', 'lodge-beam'])
    const headerZ = meshes[0].position.z + lodge.center[1]
    expect(headerZ).toBeCloseTo(frontWest[1], 6)
    expect(headerZ).toBeCloseTo(frontEast[1], 6)
  })
  test('every member ends inside the walls, behind their log faces', () => {
    for (const mesh of meshes) {
      const depths = corners(mesh).map(inside)
      expect(Math.min(...depths)).toBeGreaterThan(0.04)
      expect(Math.min(...depths)).toBeLessThan(wallFace - 0.04)
    }
  })
  test('seen from below, no two members share a face', () => {
    for (const radius of [0.3, 0.45, 0.7, 1.5, 3]) {
      for (let angle = 0; angle < 360; angle += 3.75) {
        const x = radius * Math.cos(angle * Math.PI / 180)
        const z = lodgeInterior.beams.z[0] + radius * Math.sin(angle * Math.PI / 180)
        // The ceiling slab is not among the meshes, so a ray can go between the members and hit nothing.
        expect(surfacesAbove(meshes, x, z, lodge.height - 0.01).length).toBeLessThanOrEqual(1)
      }
    }
  })
})
test('furniture geometry rejects impossible inputs', () => {
  expect(() => new UpholsteredSeatGeometry(0)).toThrow(RangeError)
  expect(() => new UpholsteredSeatGeometry(1.5)).toThrow(RangeError)
})
