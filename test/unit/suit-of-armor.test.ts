import type {BufferGeometry} from 'three/webgpu'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Box3, DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {lodgeSpurWidth, lodgeSpurWindow, lodgeSpurX} from '../../src/lib/gallery/bastion.ts'
import {lodgeSpur, lodgeSpurArmor, lodgeSpurEnd} from '../../src/lib/gallery/bastionNetwork.ts'
import {gorgetBorderReach, helmetHeight} from '../../src/lib/gallery/curios/helmet/Helmet.ts'
import {helmet} from '../../src/lib/gallery/curios/index.ts'
import {lodgeEastWindow} from '../../src/lib/gallery/lodge.ts'
import {suitOfArmor, suitOfArmorBoxes, suitOfArmorShoulders} from '../../src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry from '../../src/lib/gallery/suitOfArmorGeometry.ts'
import ArmorBeheading from '../../src/lib/physics/ArmorBeheading.ts'
import {addArmor, bastionColliders, physicsWorld} from './helpers/bastionWorld.ts'

await RAPIER.init()
const {collar} = suitOfArmor
const steel = suitOfArmorGeometry()
const material = new MeshBasicMaterial({side: DoubleSide})
const armor = new Mesh(steel, material)
const helmetModel = helmet.createModel()
// The helmet resting on the collar, in the armor’s frame
const worn = helmetModel.parts.map(({geometry}) => new Mesh(geometry.clone().translate(0, collar, 0), material))
const colliders = bastionColliders()
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
  test('its steel faces out, carries what its material reads and keeps under 16 384 triangles, and the helmet’s under 8192', () => {
    const position = steel.getAttribute('position')
    expect(position.array.every(Number.isFinite)).toBe(true)
    expect(signedVolume(steel)).toBeGreaterThan(0)
    expect(steel.getAttribute('steelMask').count).toBe(position.count)
    expect(steel.index!.count / 3).toBeLessThan(16_384)
    const helmetTriangles = helmetModel.parts.reduce((sum, {geometry}) => sum + geometry.index!.count / 3, 0)
    expect(helmetTriangles).toBeLessThan(8192)
  })
  test('it stands 160 cm tall on the floor, and with the helmet of 40 cm on it, 2 m, only its empty neck showing dark', () => {
    expect(collar).toBe(1.6)
    expect(helmetHeight).toBe(0.4)
    const bounds = boundsOf(steel)
    expect(bounds.min.y).toBeCloseTo(0, 3)
    expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6)
    // Only its collar’s lip, inside the helmet’s gorget, and the crowns of its pauldrons rise over the collar, and only a little.
    expect(bounds.max.y).toBeLessThan(collar + 0.035)
    const size = bounds.getSize(new Vector3)
    expect(size.x).toBeGreaterThan(0.6)
    expect(size.x).toBeLessThan(0.8)
    // Its sabatons point ahead, its toes further out than anything behind it.
    expect(bounds.max.z).toBeGreaterThan(-bounds.min.z)
    const helmetBounds = boundsOf(helmetModel.parts[0].geometry)
    expect(helmetBounds.min.y).toBeCloseTo(0, 6)
    expect(helmetBounds.max.y).toBeCloseTo(helmetHeight, 3)
    expect(helmet.position[1] - lodgeSpurArmor[1] + helmetBounds.max.y).toBeCloseTo(2, 2)
    const mask = steel.getAttribute('steelMask')
    const position = steel.getAttribute('position')
    for (let index = 0; index < mask.count; index++) {
      if (!(mask.getX(index) > 0)) {
        continue
      }
      expect(Math.hypot(position.getX(index), position.getZ(index))).toBeLessThan(0.075)
      expect(position.getY(index)).toBeLessThan(collar + 0.02)
    }
  })
  test('its plates roll their edges, honed bright, and rivets hold them', () => {
    const mask = steel.getAttribute('steelMask')
    const polishes = new Set(Array.from({length: mask.count}, (_, index) => Math.round(mask.getY(index) * 100) / 100))
    // the plates’ own polish, the rolled edges’ and the rivet heads’
    for (const polish of [0.1, 0.4, 0.5]) {
      expect(polishes.has(polish)).toBe(true)
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
    expect(checked).toBeGreaterThan(200)
  })
  test('its body’s boxes wrap its steel, none over the collar, where the surface across its shoulders lies level for the helmet', () => {
    const reach = new Box3
    for (const {from, to} of suitOfArmorBoxes) {
      reach.expandByPoint(new Vector3(...from)).expandByPoint(new Vector3(...to))
    }
    expect(reach.max.y).toBeLessThan(collar)
    expect(reach.min.y).toBeCloseTo(0, 6)
    expect(suitOfArmorBoxes.reduce((sum, {mass}) => sum + mass, 0)).toBe(suitOfArmor.mass)
    const [vertices] = suitOfArmorShoulders()
    for (let index = 1; index < vertices.length; index += 3) {
      expect(vertices[index]).toBeCloseTo(collar, 6)
    }
    // the helmet’s gorget, a third of a meter across, rests on it
    expect(Math.max(...vertices.filter((_, index) => index % 3 === 0))).toBeGreaterThan(gorgetBorderReach(90))
    const bounds = boundsOf(steel)
    expect(reach.min.x - bounds.min.x).toBeLessThan(0.01)
    expect(bounds.max.x - reach.max.x).toBeLessThan(0.01)
    expect(reach.min.z - bounds.min.z).toBeLessThan(0.01)
    // Its chest reaches furthest ahead, the points of its sabatons only a little further, so a player walking into it pushes its chest.
    const chest = suitOfArmorBoxes.find(({name}) => name === 'chest')!
    expect(reach.max.z).toBe(chest.to[2])
    for (const {name, to} of suitOfArmorBoxes) {
      if (name !== 'chest') {
        expect(to[2]).toBeLessThan(chest.to[2] - 0.02)
      }
    }
    expect(bounds.max.z - reach.max.z).toBeLessThan(0.05)
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
    const helmetTop = collar + helmetHeight
    expect(lodgeSpurWindow.width).toBeGreaterThan(bounds.max.x - bounds.min.x + 0.3)
    expect(lodgeSpurWindow.bottom).toBeLessThan(collar - 0.3)
    expect(lodgeSpurWindow.height - lodgeSpurWindow.rise).toBeGreaterThan(helmetTop + 0.2)
    expect(helmet.position).toEqual([x, y + collar + 0.001, z])
    expect(helmet.rotation).toEqual([0, 0, 0])
  })
})
/** The suit of armor and the helmet on its shoulders in the Bastion, as the game builds them, with what keeps the helmet on until it is knocked off. */
function scene() {
  const world = physicsWorld(colliders)
  const body = addArmor(world)
  const head = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...helmet.position).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.convexHull(helmetModel.hull)!.setMass(helmet.mass).setFriction(0.8).setRestitution(0.32), head)
  const beheading = new ArmorBeheading(world, body, () => head)
  const armorColliders = new Set(Array.from({length: body.numColliders()}, (_, index) => body.collider(index).handle))
  const events = new RAPIER.EventQueue(true)
  /** Steps the world for `seconds`, pushing the suit’s chest with `force`, in newtons, for `pushing` seconds from the half second on, and returns the step it lost its head on, if any. */
  const run = (seconds: number, force?: readonly [x: number, z: number], pushing = 0.25) => {
    let beheadedAt: number | undefined
    for (let step = 0; step < seconds * 60; step++) {
      if (force && step >= 30 && step < 30 + pushing * 60) {
        const {x, y, z} = body.translation()
        body.applyImpulseAtPoint({
          x: force[0] / 60,
          y: 0,
          z: force[1] / 60,
        }, {
          x,
          y: y + 1.35,
          z,
        }, true)
      }
      world.step(events)
      events.drainCollisionEvents((first, second, started) => {
        const [own, other] = armorColliders.has(first) ? [first, second] : [second, first]
        if (started && armorColliders.has(own) && other !== head.collider(0).handle && beheading.struck()) {
          beheadedAt ??= step
        }
      })
      if (beheading.update()) {
        beheadedAt ??= step
      }
    }
    return beheadedAt
  }
  /** how far the helmet lies from the suit’s collar, wherever the suit leans */
  const headFromCollar = () => {
    const {w, x, y, z} = body.rotation()
    const up = new Vector3(0, 1, 0)
    up.applyQuaternion(new Quaternion(x, y, z, w))
    const at = body.translation()
    const top = new Vector3(at.x, at.y, at.z)
    top.addScaledVector(up, collar)
    const {x: hx, y: hy, z: hz} = head.translation()
    return top.distanceTo(new Vector3(hx, hy, hz))
  }
  return {
    beheading,
    body,
    head,
    headFromCollar,
    run,
    world,
  }
}
describe('pushed, the suit of armor tips over and loses its head', () => {
  test('left alone, it stands still with the helmet on its shoulders and falls asleep', () => {
    const {beheading, body, head, headFromCollar, run, world} = scene()
    try {
      expect(run(3)).toBeUndefined()
      expect(body.isSleeping()).toBe(true)
      expect(head.isSleeping()).toBe(true)
      expect(beheading.lean).toBeLessThan(0.5)
      expect(headFromCollar()).toBeLessThan(0.01)
      const {x, y, z} = body.translation()
      expect(Math.hypot(x - lodgeSpurArmor[0], z - lodgeSpurArmor[2])).toBeLessThan(0.005)
      expect(y).toBeCloseTo(lodgeSpurArmor[1], 2)
    } finally {
      world.free()
    }
  })
  test('a light nudge only rocks it, and it keeps its head', () => {
    const {beheading, headFromCollar, run, world} = scene()
    try {
      expect(run(4, [0, 40])).toBeUndefined()
      expect(beheading.beheaded).toBe(false)
      expect(beheading.lean).toBeLessThan(2)
      expect(headFromCollar()).toBeLessThan(0.05)
    } finally {
      world.free()
    }
  })
  for (const [label, force, wall] of [
    ['back, it falls against the barred window’s wall, which knocks its head off', [0, -150], true],
    ['forward, it falls flat on its face on the floor and its head flies off', [0, 400], false],
    ['sideways, it falls against the branch’s wall and loses its head', [400, 0], true],
  ] as const) {
    test(`pushed ${label}`, () => {
      const {beheading, head, headFromCollar, run, world} = scene()
      try {
        run(10, force)
        expect(beheading.lean).toBeGreaterThan(suitOfArmor.toppled)
        if (!wall) {
          expect(beheading.lean).toBeGreaterThan(70)
        }
        // Thrown off, or knocked off by the fall, the helmet lies somewhere apart, at rest.
        expect(headFromCollar()).toBeGreaterThan(0.4)
        expect(head.isSleeping()).toBe(true)
        expect(head.translation().y).toBeLessThan(lodgeSpurArmor[1] + collar - 0.3)
      } finally {
        world.free()
      }
    })
  }
  test('it loses its head once, and only while it still wears it', () => {
    const {beheading, body, run, world} = scene()
    try {
      // Upright, a knock does nothing.
      expect(beheading.struck()).toBeUndefined()
      run(6, [0, -150])
      const knocked = beheading.beheaded
      // Its head is off by now, whether it was thrown or fell; no knock throws it again.
      expect(beheading.struck()).toBeUndefined()
      expect(beheading.update()).toBeUndefined()
      expect(knocked || beheading.lean > suitOfArmor.toppled).toBe(true)
      expect(body.isSleeping()).toBe(true)
    } finally {
      world.free()
    }
  })
})
