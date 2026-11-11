import type {BufferGeometry} from 'three/webgpu'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Box3, DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {lodgeSpurWidth, lodgeSpurWindow, lodgeSpurX} from '../../src/lib/gallery/bastion.ts'
import {lodgeSpur, lodgeSpurArmor, lodgeSpurEnd} from '../../src/lib/gallery/bastionNetwork.ts'
import {gorgetBorderReach} from '../../src/lib/gallery/curios/helmet/Helmet.ts'
import {helmet} from '../../src/lib/gallery/curios/index.ts'
import {lodgeEastWindow} from '../../src/lib/gallery/lodge.ts'
import {suitOfArmor, suitOfArmorCenterOfMass, suitOfArmorColliders} from '../../src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry from '../../src/lib/gallery/suitOfArmorGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {addHelmet, bastionColliders, physicsWorld, suitOfArmorBody} from './helpers/bastionWorld.ts'

await RAPIER.init()
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
const upOf = (body: RAPIER.RigidBody) => {
  const {w, x, y, z} = body.rotation()
  const up = new Vector3(0, 1, 0)
  return up.applyQuaternion(new Quaternion(x, y, z, w))
}
/** where the collar seat stands in the world, for telling whether the helmet still sits on it */
const seatOf = (body: RAPIER.RigidBody) => {
  const {w, x, y, z} = body.rotation()
  const translation = body.translation()
  const seat = new Vector3(0, collar, 0)
  return seat.applyQuaternion(new Quaternion(x, y, z, w)).add(new Vector3(translation.x, translation.y, translation.z))
}
describe('the suit of armor', () => {
  test('its steel faces out, carries what its material reads and keeps within 16 384 triangles', () => {
    const position = steel.getAttribute('position')
    expect(position.array.every(Number.isFinite)).toBe(true)
    expect(signedVolume(steel)).toBeGreaterThan(0)
    expect(steel.getAttribute('steelMask').count).toBe(position.count)
    expect(triangleCount(steel)).toBeLessThanOrEqual(16_384)
    expect(triangleCount(steel)).toBeGreaterThan(8192)
  })
  test('the headless body stands exactly 160 cm on the floor and the 40 cm helmet takes it to exactly 200 cm', () => {
    const bounds = boundsOf(steel)
    expect(bounds.min.y).toBeCloseTo(0, 3)
    expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6)
    expect(bounds.max.y).toBeCloseTo(suitOfArmor.bodyHeight, 3)
    expect(suitOfArmor.bodyHeight).toBe(1.6)
    expect(collar).toBe(1.6)
    const size = bounds.getSize(new Vector3)
    expect(size.x).toBeGreaterThan(0.6)
    expect(size.x).toBeLessThan(0.78)
    // Its sabatons point ahead, its toes further out than anything behind it.
    expect(bounds.max.z).toBeGreaterThan(-bounds.min.z)
    const helmetBounds = new Box3
    for (const {geometry} of helmetModel.parts) {
      helmetBounds.union(boundsOf(geometry))
    }
    expect(helmetBounds.min.y).toBeCloseTo(0, 3)
    // The helmet alone is 40 cm, from its gorget’s border to the crown of its comb.
    expect(helmetBounds.max.y).toBeCloseTo(0.4, 3)
    expect(helmetModel.parts.reduce((sum, {geometry}) => sum + triangleCount(geometry), 0)).toBeLessThan(8192)
    const helmetTop = Math.max(...worn.map(({geometry}) => boundsOf(geometry).max.y))
    expect(helmetTop).toBeCloseTo(2, 2)
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
      expect(hit.point.y).toBeGreaterThan(collar - 0.01)
    }
  })
  test('none of its steel over the collar comes near the helmet’s, lying well inside its gorget or well beside it', () => {
    const position = steel.getAttribute('position')
    const ray = new Raycaster
    let checked = 0
    for (let index = 0; index < position.count; index++) {
      const [x, y, z] = [position.getX(index), position.getY(index), position.getZ(index)]
      if (y < collar - 1e-9) {
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
    expect(checked).toBeGreaterThan(30)
  })
  test('its physics frame wraps its steel, stands on flat sabatons and seats the helmet on a flat top level with the collar', () => {
    expect(suitOfArmorColliders.reduce((sum, collider) => sum + collider.mass, 0)).toBeCloseTo(suitOfArmor.mass, 9)
    const bounds = boundsOf(steel)
    let [minX, maxX, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity]
    for (const collider of suitOfArmorColliders) {
      const [x, y, z] = collider.position
      const half = collider.kind === 'ball' ? [collider.size as number, collider.size as number, collider.size as number] : (collider.kind === 'cylinder' ? [(collider.size as readonly [number, number])[0], (collider.size as readonly [number, number])[1] / 2, (collider.size as readonly [number, number])[0]] : (collider.size as readonly [number, number, number]).map(value => value / 2))
      if (collider.kind !== 'ball') {
        // Nothing pokes meaningfully out of the steel but the shoulder balls under their pauldrons.
        expect(x - half[0] - bounds.min.x).toBeGreaterThan(-0.03)
        expect(bounds.max.x - (x + half[0])).toBeGreaterThan(-0.03)
      }
      minX = Math.min(minX, x - half[0])
      maxX = Math.max(maxX, x + half[0])
      minZ = Math.min(minZ, z - half[2])
      maxZ = Math.max(maxZ, z + half[2])
      expect(y - half[1]).toBeGreaterThanOrEqual(-1e-9)
    }
    expect(minX).toBeGreaterThan(bounds.min.x - 0.03)
    expect(maxZ).toBeLessThan(bounds.max.z + 0.01)
    expect(minZ).toBeGreaterThan(bounds.min.z - 0.03)
    // The seat’s top is level with the collar, and the sabatons’ soles are the floor.
    const seat = suitOfArmorColliders[0]
    expect(seat.position[1] + (seat.kind === 'cuboid' ? (seat.size as readonly [number, number, number])[1] / 2 : 0)).toBeCloseTo(collar, 9)
    // Low and centered over its feet, so it stands steady and sleeps standing up.
    const center = suitOfArmorCenterOfMass()
    expect(center[1]).toBeGreaterThan(0.65)
    expect(center[1]).toBeLessThan(0.95)
    expect(Math.abs(center[0])).toBeLessThan(0.02)
    expect(center[2]).toBeGreaterThan(minZ + 0.05)
    expect(center[2]).toBeLessThan(maxZ - 0.05)
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
/**
 * Steps the Bastion with the armor and the helmet resting on it, as the game builds them.
 * With `push`, a steady 300 N shove at chest height toward -z all the while — what a player walking into it
 * keeps up, the motor’s own push being capped well above that — then it settles.
 */
function spurWorld(push = 0) {
  const world = physicsWorld(bastionColliders())
  const body = suitOfArmorBody(world)
  const head = addHelmet(world)
  for (let step = 0; step < 60 * 3; step++) {
    world.step()
  }
  if (push) {
    for (let step = 0; step < 60 * 2.5; step++) {
      const translation = body.translation()
      body.applyImpulseAtPoint({
        x: 0,
        y: 0,
        z: -push / 60,
      }, {
        x: translation.x,
        y: translation.y + 1.35,
        z: translation.z,
      }, true)
      world.step()
    }
    for (let step = 0; step < 60 * 12; step++) {
      world.step()
    }
  }
  return {
    body,
    head,
    world,
  }
}
describe('the suit of armor’s physics', () => {
  test('it stands and sleeps where it stands, with the helmet asleep on its collar, and a bump does not move it', () => {
    const {body, head, world} = spurWorld()
    try {
      expect(body.isSleeping()).toBe(true)
      expect(head.isSleeping()).toBe(true)
      const translation = body.translation()
      expect(Math.hypot(translation.x - lodgeSpurArmor[0], translation.z - lodgeSpurArmor[2])).toBeLessThan(0.02)
      expect(upOf(body).y).toBeGreaterThan(0.99)
      const headTranslation = head.translation()
      expect(Math.abs(headTranslation.y - helmet.position[1])).toBeLessThan(0.01)
      // A knock: one hard orb’s worth of impulse at its chest rocks it, and it settles upright again.
      body.applyImpulseAtPoint({
        x: 0,
        y: 0,
        z: -6,
      }, {
        x: translation.x,
        y: translation.y + 1.3,
        z: translation.z,
      }, true)
      for (let step = 0; step < 60 * 6; step++) {
        world.step()
      }
      expect(upOf(body).y).toBeGreaterThan(0.95)
      const settledHead = head.translation()
      expect(seatOf(body).distanceTo(new Vector3(settledHead.x, settledHead.y, settledHead.z))).toBeLessThan(0.45)
    } finally {
      world.free()
    }
  })
  test('pushing it over makes it hit the wall behind it and lose its head, which comes to rest on the floor', () => {
    const {body, head, world} = spurWorld(300)
    try {
      // Tipped well past standing, asleep against the barred window’s wall.
      expect(upOf(body).y).toBeLessThan(0.92)
      expect(body.isSleeping()).toBe(true)
      // The head is off: nowhere near the collar seat any more, down at the floor it fell to.
      const headTranslation = head.translation()
      expect(seatOf(body).distanceTo(new Vector3(headTranslation.x, headTranslation.y, headTranslation.z))).toBeGreaterThan(0.5)
      expect(headTranslation.y).toBeLessThan(helmet.position[1] - 1)
      expect(head.isSleeping()).toBe(true)
    } finally {
      world.free()
    }
  })
})

