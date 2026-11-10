import type {NodeMaterial} from 'three/webgpu'

import {afterAll, describe, expect, test} from 'bun:test'

import {AmbientLight, DirectionalLight, DoubleSide, HemisphereLight, Material, Mesh, MeshBasicMaterial, PointLight, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import lodge, {lodgeBay, lodgeOutline} from '../../src/lib/gallery/lodge.ts'
import lodgeInterior, {lodgeFurnitureColliders} from '../../src/lib/gallery/lodgeInterior/layout.ts'
import LodgeCeilingGeometry from '../../src/lib/gallery/lodgeInterior/LodgeCeilingGeometry.ts'
import UpholsteredSeatGeometry from '../../src/lib/gallery/lodgeInterior/UpholsteredSeatGeometry.ts'
import WagonWheelGeometry from '../../src/lib/gallery/lodgeInterior/WagonWheelGeometry.ts'
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
  const wheel = new WagonWheelGeometry(0.85)
  try {
    const parts = [sofa.leather, sofa.timber, chair.leather, chair.timber, wheel.iron, wheel.wax, wheel.flames]
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
    // The wheel’s canopy meets the ceiling.
    wheel.iron.computeBoundingBox()
    expect(wheel.iron.boundingBox!.max.y).toBeCloseTo(0.85, 3)
  } finally {
    for (const resource of [sofa, chair, wheel]) {
      resource.dispose()
    }
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
describe('the bay’s ceiling and chandelier', () => {
  const {bayFraming, chandelier} = lodgeInterior
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
  test('the chandelier hangs from the boss in the middle of the bay’s mouth, in line with its first corners', () => {
    const [frontWest, , , frontEast] = lodgeBay.corners
    expect(bayFraming.center[0] + lodge.center[0]).toBeCloseTo((frontWest[0] + frontEast[0]) / 2, 6)
    expect(bayFraming.center[1] + lodge.center[1]).toBeCloseTo(frontWest[1], 6)
    expect(bayFraming.center[1] + lodge.center[1]).toBeCloseTo(frontEast[1], 6)
    expect([chandelier.position[0], chandelier.position[2]]).toEqual([...bayFraming.center])
    expect(chandelier.position[1] + chandelier.drop).toBeCloseTo(lodge.height - bayFraming.boss.height, 6)
    expect(chandelier.position[1] - 0.15).toBeGreaterThan(2.5)
    const boss = meshes.find(mesh => mesh.name === 'lodge-ceiling-boss')!
    const [bottom] = surfacesAbove([boss], chandelier.position[0], chandelier.position[2], lodge.height)
    expect(bottom.point.y).toBeCloseTo(chandelier.position[1] + chandelier.drop, 6)
    // The header across the bay’s mouth runs right through the boss.
    expect(lodgeInterior.beams.z[0]).toBeCloseTo(bayFraming.center[1], 6)
  })
  test('hips run from the boss into the bay’s back corners and a rafter to its back wall, square to the boss and the wheel’s spokes but for the hips’ 5.5°', () => {
    const fan = meshes.filter(mesh => mesh.name === 'lodge-hip' || mesh.name === 'lodge-rafter')
    expect(fan.map(mesh => mesh.name)).toEqual(['lodge-hip', 'lodge-rafter', 'lodge-hip'])
    for (const [i, mesh] of fan.entries()) {
      const [x, z] = bayFraming.rafters[i]
      // The hips come to a point in their corners; the rafter ends square, half its width to either side of its target.
      expect(Math.min(...corners(mesh).map(point => Math.hypot(point.x - x, point.z - z)))).toBeLessThan(i === 1 ? Math.hypot(bayFraming.rafter[0] / 2, 0.07) : 0.07)
      // The boss’ faces look along multiples of 45°, after the wheel turns by its yaw so do its spokes.
      const angle = Math.atan2(z - bayFraming.center[1], x - bayFraming.center[0]) / Math.PI * 180
      const offFace = Math.abs((angle % 45 + 67.5) % 45 - 22.5)
      expect(offFace).toBeLessThan(i === 1 ? 1e-6 : 6)
    }
    expect(Math.abs(((chandelier.yaw / Math.PI * 180 + 22.5) % 45 + 45) % 45)).toBeCloseTo(0, 6)
  })
  test('every member ends inside the walls, behind their log faces', () => {
    for (const mesh of meshes) {
      const depths = corners(mesh).map(inside)
      expect(Math.min(...depths)).toBeGreaterThan(0.04)
      if (mesh.name !== 'lodge-ceiling-boss') {
        expect(Math.min(...depths)).toBeLessThan(wallFace - 0.04)
      }
    }
  })
  test('seen from below, no two members share a face', () => {
    for (const radius of [0.3, 0.45, 0.7, 1.5, 3]) {
      for (let angle = 0; angle < 360; angle += 3.75) {
        const x = bayFraming.center[0] + radius * Math.cos(angle * Math.PI / 180)
        const z = bayFraming.center[1] + radius * Math.sin(angle * Math.PI / 180)
        // The ceiling slab is not among the meshes, so a ray can go between the members and hit nothing.
        expect(surfacesAbove(meshes, x, z, lodge.height - 0.01).length).toBeLessThanOrEqual(1)
      }
    }
  })
})
test('furniture geometry rejects impossible inputs', () => {
  expect(() => new UpholsteredSeatGeometry(0)).toThrow(RangeError)
  expect(() => new UpholsteredSeatGeometry(1.5)).toThrow(RangeError)
  expect(() => new WagonWheelGeometry(0.2)).toThrow(RangeError)
})
