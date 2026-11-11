import type {BufferGeometry} from 'three/webgpu'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Box3, DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {lodgeSpurWidth, lodgeSpurWindow, lodgeSpurX} from '../../src/lib/gallery/bastion.ts'
import {lodgeSpur, lodgeSpurArmor, lodgeSpurEnd} from '../../src/lib/gallery/bastionNetwork.ts'
import {gorgetBorderReach, helmetHeight} from '../../src/lib/gallery/curios/helmet/Helmet.ts'
import {helmet} from '../../src/lib/gallery/curios/index.ts'
import {lodgeEastWindow} from '../../src/lib/gallery/lodge.ts'
import {suitOfArmor, suitOfArmorBoxes} from '../../src/lib/gallery/suitOfArmor.ts'
import suitOfArmorGeometry, {suitOfArmorCradle} from '../../src/lib/gallery/suitOfArmorGeometry.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
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
  test('its body’s boxes wrap its steel, none over the collar, where the helmet sits in the cradle across its shoulders', () => {
    const reach = new Box3
    for (const {from, to} of suitOfArmorBoxes) {
      reach.expandByPoint(new Vector3(...from)).expandByPoint(new Vector3(...to))
    }
    expect(reach.max.y).toBeLessThan(collar)
    expect(reach.min.y).toBeCloseTo(0, 6)
    expect(suitOfArmorBoxes.reduce((sum, {mass}) => sum + mass, 0)).toBe(suitOfArmor.mass)
    expect(reach.max.y).toBeGreaterThan(collar - 0.015)
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
  test('its cradle sinks under the helmet’s gorget and rises outward from its border, where the border sits on its skin, level at the collar all round', () => {
    const [vertices, indices] = suitOfArmorCradle()
    const rise = Math.tan(suitOfArmor.cradle * Math.PI / 180)
    let [inside, outside] = [0, 0]
    for (let index = 0; index < vertices.length; index += 3) {
      const [x, y, z] = vertices.subarray(index, index + 3)
      const border = gorgetBorderReach(Math.atan2(x, z) * 180 / Math.PI)
      const reach = Math.hypot(x, z)
      expect(y + weldedSurfaceSkin).toBeCloseTo(collar + (reach - border) * rise, 6)
      if (reach < border - 0.02) {
        inside++
      }
      if (reach > border + 0.02) {
        outside++
      }
    }
    expect(inside).toBeGreaterThan(40)
    expect(outside).toBeGreaterThan(40)
    // facing up
    const [a, b, c] = [new Vector3, new Vector3, new Vector3]
    for (let index = 0; index < indices.length; index += 3) {
      a.fromArray(vertices, indices[index] * 3)
      b.fromArray(vertices, indices[index + 1] * 3)
      c.fromArray(vertices, indices[index + 2] * 3)
      expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0)
    }
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
/** The suit of armor and the helmet on its shoulders in the Bastion, as the game builds them, and nothing else keeping the helmet on. */
function scene() {
  const world = physicsWorld(colliders)
  const body = addArmor(world)
  const head = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...helmet.position).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.convexHull(helmetModel.hull)!.setMass(helmet.mass).setFriction(0.8).setRestitution(0.32), head)
  /** Steps the world for `seconds`, pushing the suit’s chest with `force`, in newtons, for a quarter second from the half second on. */
  const run = (seconds: number, force?: readonly [x: number, z: number]) => {
    for (let step = 0; step < seconds * 60; step++) {
      if (force && step >= 30 && step < 45) {
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
      world.step()
    }
  }
  /** which way `of` turns its own up */
  const upOf = (of: RAPIER.RigidBody) => {
    const {w, x, y, z} = of.rotation()
    const up = new Vector3(0, 1, 0)
    return up.applyQuaternion(new Quaternion(x, y, z, w))
  }
  /** how far it leans from upright, in degrees */
  const lean = () => Math.acos(Math.min(1, Math.max(-1, upOf(body).y))) * 180 / Math.PI
  /** where the helmet lies in the suit’s frame */
  const headInFrame = () => {
    const at = body.translation()
    const {x, y, z} = head.translation()
    const {w, x: qx, y: qy, z: qz} = body.rotation()
    const offset = new Vector3(x - at.x, y - at.y, z - at.z)
    const turn = new Quaternion(qx, qy, qz, w)
    return offset.applyQuaternion(turn.invert())
  }
  /** whether the helmet still sits in its cradle, upright on its shoulders */
  const seated = () => {
    const {x, y, z} = headInFrame()
    return Math.abs(y - collar) < 0.05 && Math.hypot(x, z) < 0.1 && upOf(head).angleTo(upOf(body)) < 0.3
  }
  return {
    body,
    head,
    headInFrame,
    lean,
    run,
    seated,
    world,
  }
}
describe('pushed, the suit of armor tips over, and the helmet goes wherever the fall takes it', () => {
  test('left alone, it stands still with the helmet in its cradle and falls asleep', () => {
    const {body, head, headInFrame, lean, run, world} = scene()
    try {
      run(3)
      expect(body.isSleeping()).toBe(true)
      expect(head.isSleeping()).toBe(true)
      expect(lean()).toBeLessThan(0.5)
      expect(headInFrame().distanceTo(new Vector3(0, collar, 0))).toBeLessThan(0.005)
      const {x, y, z} = body.translation()
      expect(Math.hypot(x - lodgeSpurArmor[0], z - lodgeSpurArmor[2])).toBeLessThan(0.005)
      expect(y).toBeCloseTo(lodgeSpurArmor[1], 2)
    } finally {
      world.free()
    }
  })
  for (const force of [40, 60]) {
    test(`rocked by a nudge of ${force} N, it rights itself, and the helmet settles back into the middle of its cradle`, () => {
      const {headInFrame, lean, run, seated, world} = scene()
      try {
        run(6, [0, force])
        expect(lean()).toBeLessThan(0.5)
        expect(seated()).toBe(true)
        const {x, z} = headInFrame()
        expect(Math.hypot(x, z)).toBeLessThan(0.02)
      } finally {
        world.free()
      }
    })
  }
  test('pushed hard in any direction, it falls, against a wall or onto the floor, and nearly always loses its head', () => {
    let headless = 0
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6
      const {body, head, lean, run, seated, world} = scene()
      try {
        run(15, [Math.sin(angle) * 400, Math.cos(angle) * 400])
        expect(lean()).toBeGreaterThan(20)
        expect(body.isSleeping()).toBe(true)
        expect(head.isSleeping()).toBe(true)
        if (!seated()) {
          headless++
        }
      } finally {
        world.free()
      }
    }
    expect(headless).toBeGreaterThanOrEqual(10)
  }, 30_000)
  test('a player walking into it from down the branch knocks it over, and the helmet falls to the floor', () => {
    const {body, head, lean, run, seated, world} = scene()
    const player = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(lodgeSpurArmor[0], lodgeSpurArmor[1] + 0.04, lodgeSpurArmor[2] + 1.6))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3).setTranslation(0, 0.85, 0), player)
    const motor = new EgoMotor(RAPIER, world, player, collider)
    try {
      const facing = new Quaternion
      for (let step = 0; step < 60; step++) {
        motor.step(world.timestep, {forward: true}, facing)
        world.step()
      }
      motor.dispose()
      world.removeRigidBody(player)
      run(12)
      expect(lean()).toBeGreaterThan(20)
      expect(seated()).toBe(false)
      expect(head.translation().y - lodgeSpurArmor[1]).toBeLessThan(0.3)
      expect(body.isSleeping()).toBe(true)
      expect(head.isSleeping()).toBe(true)
    } finally {
      world.free()
    }
  })
})
