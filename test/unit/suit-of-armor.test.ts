import type {BufferGeometry} from 'three/webgpu'

import {afterAll, describe, expect, test} from 'bun:test'

import {Box3, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {lodgeSpurWidth, lodgeSpurWindow, lodgeSpurX} from '../../src/lib/gallery/bastion.ts'
import {lodgeSpur, lodgeSpurArmor, lodgeSpurEnd} from '../../src/lib/gallery/bastionNetwork.ts'
import {gorgetBorderReach} from '../../src/lib/gallery/curios/helmet/Helmet.ts'
import {helmet} from '../../src/lib/gallery/curios/index.ts'
import {lodgeEastWindow} from '../../src/lib/gallery/lodge.ts'
import {suitOfArmor, suitOfArmorCollision} from '../../src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry from '../../src/lib/gallery/suitOfArmorGeometry.ts'

const {collar} = suitOfArmor
const steel = suitOfArmorGeometry()
const material = new MeshBasicMaterial({side: DoubleSide})
const armor = new Mesh(steel, material)
const helmetModel = helmet.createModel()
// The helmet resting on the collar, in the armor’s frame
const worn = helmetModel.parts.map(({geometry}) => new Mesh(geometry.clone().translate(0, collar, 0), material))
afterAll(() => {
  steel.dispose()
  material.dispose()
  helmetModel.dispose()
  for (const mesh of worn) {
    mesh.geometry.dispose()
  }
})
const boundsOf = (geometry: BufferGeometry) => {
  const bounds = new Box3
  return bounds.setFromBufferAttribute(geometry.getAttribute('position') as never)
}
/** the volume a surface encloses, positive while it faces out */
const signedVolume = (geometry: BufferGeometry) => {
  const position = geometry.getAttribute('position')
  const index = geometry.index!
  const [a, b, c] = [new Vector3, new Vector3, new Vector3]
  let volume = 0
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1))
    c.fromBufferAttribute(position, index.getX(i + 2))
    volume += a.dot(b.cross(c)) / 6
  }
  return volume
}
describe('the suit of armor', () => {
  test('its steel faces out, carries what its material reads and keeps within 16 384 triangles', () => {
    const position = steel.getAttribute('position')
    expect(position.array.every(Number.isFinite)).toBe(true)
    expect(signedVolume(steel)).toBeGreaterThan(0)
    expect(steel.getAttribute('steelMask').count).toBe(position.count)
    expect(steel.index!.count / 3).toBeLessThanOrEqual(16_384)
  })
  test('it stands on the floor as tall as a knight, the helmet on it, and only its empty neck shows dark', () => {
    const bounds = boundsOf(steel)
    expect(bounds.min.y).toBeCloseTo(0, 3)
    expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6)
    // Its pauldrons rise beside the gorget, a little over the collar.
    expect(bounds.max.y).toBeLessThan(collar + 0.04)
    const size = bounds.getSize(new Vector3)
    expect(size.x).toBeGreaterThan(0.55)
    expect(size.x).toBeLessThan(0.75)
    // Its sabatons point ahead, its toes further out than anything behind it.
    expect(bounds.max.z).toBeGreaterThan(-bounds.min.z)
    const helmetTop = Math.max(...worn.map(({geometry}) => boundsOf(geometry).max.y))
    expect(helmetTop).toBeGreaterThan(1.75)
    expect(helmetTop).toBeLessThan(1.9)
    const mask = steel.getAttribute('steelMask')
    const position = steel.getAttribute('position')
    for (let index = 0; index < mask.count; index++) {
      if (!(mask.getX(index) > 0)) {
        continue
      }
      expect(Math.hypot(position.getX(index), position.getZ(index))).toBeLessThan(0.07)
      expect(position.getY(index)).toBeLessThan(collar + 0.02)
    }
  })
  test('the border of the helmet’s gorget rests on its shoulders all round, the steel a hair under it', () => {
    const ray = new Raycaster
    for (let theta = -180; theta < 180; theta += 7.5) {
      const reach = gorgetBorderReach(theta) - 0.002
      const [x, z] = [reach * Math.sin(theta * Math.PI / 180), reach * Math.cos(theta * Math.PI / 180)]
      ray.set(new Vector3(x, collar + 0.05, z), new Vector3(0, -1, 0))
      const [hit] = ray.intersectObject(armor)
      expect(hit).toBeDefined()
      expect(hit.point.y).toBeLessThan(collar)
      expect(hit.point.y).toBeGreaterThan(collar - 0.004)
    }
  })
  test('none of its steel over the collar comes near the helmet’s, lying well inside its gorget or well beside it', () => {
    const position = steel.getAttribute('position')
    const ray = new Raycaster
    let checked = 0
    for (let index = 0; index < position.count; index++) {
      const [x, y, z] = [position.getX(index), position.getY(index), position.getZ(index)]
      if (y < collar) {
        continue
      }
      const reach = Math.hypot(x, z)
      ray.set(new Vector3(0, y, 0), new Vector3(x / reach, 0, z / reach))
      const [hit] = ray.intersectObjects(worn)
      expect(hit).toBeDefined()
      const clearance = hit.distance - reach
      expect(clearance > 0.003 || clearance < -0.01).toBe(true)
      checked++
    }
    expect(checked).toBeGreaterThan(300)
  })
  test('its collision wraps its steel, reaching up to the collar only with its body’s level top, for the helmet to rest on', () => {
    const collision = suitOfArmorCollision()
    const reach = boundsOf(collision)
    const position = collision.getAttribute('position')
    const high = Array.from({length: position.count}, (_, index) => [position.getX(index), position.getY(index), position.getZ(index)]).filter(([, y]) => y > collar - 0.05)
    collision.dispose()
    expect(reach.max.y).toBeCloseTo(collar, 6)
    for (const [x, y, z] of high) {
      expect(y).toBeCloseTo(collar, 6)
      // the helmet’s gorget, a third of a meter across, rests on it
      expect(Math.abs(x)).toBeGreaterThan(0.17)
      expect(z > 0.17 || z < -0.15).toBe(true)
    }
    const bounds = boundsOf(steel)
    expect(reach.min.y).toBeCloseTo(0, 6)
    expect(reach.min.x - bounds.min.x).toBeLessThan(0.02)
    expect(bounds.max.x - reach.max.x).toBeLessThan(0.02)
    expect(reach.min.z - bounds.min.z).toBeLessThan(0.03)
    expect(bounds.max.z - reach.max.z).toBeLessThan(0.03)
  })
  test('it stands on the level floor near the end of the Bastion’s blind branch beside the Lodge, abreast of where the Lodge’s window ends, clear of its walls, looking back down it', () => {
    const [x, y, z] = lodgeSpurArmor
    expect(z).toBeCloseTo(lodgeEastWindow.z - lodgeEastWindow.width / 2 - lodgeEastWindow.border, 9)
    const bounds = boundsOf(steel).translate(new Vector3(x, y, z))
    for (const [px, pz] of [[bounds.min.x, bounds.min.z], [bounds.max.x, bounds.min.z], [bounds.min.x, bounds.max.z], [bounds.max.x, bounds.max.z]]) {
      expect(lodgeSpur.floorAt(px, pz)).toBeCloseTo(y, 6)
    }
    const inner = lodgeSpurWidth / 2 - wallFace
    expect(bounds.min.x).toBeGreaterThan(lodgeSpurX - inner + 0.5)
    expect(bounds.max.x).toBeLessThan(lodgeSpurX + inner - 0.5)
    const endFace = lodgeSpurEnd.center[2] + wallFace
    expect(bounds.min.z - endFace).toBeGreaterThan(0.3)
    // The barred window behind it is wider than its shoulders, opens under them and reaches well over the helmet.
    const helmetTop = Math.max(...worn.map(({geometry}) => boundsOf(geometry).max.y))
    expect(lodgeSpurWindow.width).toBeGreaterThan(bounds.max.x - bounds.min.x + 0.3)
    expect(lodgeSpurWindow.bottom).toBeLessThan(collar - 0.3)
    expect(lodgeSpurWindow.height - lodgeSpurWindow.rise).toBeGreaterThan(helmetTop + 0.2)
    expect(helmet.position).toEqual([x, y + collar + 0.001, z])
    expect(helmet.rotation).toEqual([0, 0, 0])
  })
})
