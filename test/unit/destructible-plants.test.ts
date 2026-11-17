import type {DestructiblePlantKind} from '../../src/lib/gallery/destructiblePlants/catalog.ts'

import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Euler, Matrix4, Quaternion, Vector3} from 'three/webgpu'

import destructiblePlants from '../../src/lib/gallery/destructiblePlants/catalog.ts'
import DestructiblePlantGeometry from '../../src/lib/gallery/destructiblePlants/DestructiblePlantGeometry.ts'
import {potDefinition} from '../../src/lib/gallery/plantDecorations/catalog.ts'
import PotGeometry from '../../src/lib/gallery/plantDecorations/PotGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import initializeFoliageCollider from '../../src/lib/physics/initializeFoliageCollider.ts'
import {itemMass, launchSpeed} from '../../src/lib/physics/itemLaunch.ts'
import PlantAttachment from '../../src/lib/physics/PlantAttachment.ts'
import {leafPhysics} from '../../src/lib/physics/plantPhysics.ts'

await RAPIER.init()
let world: RAPIER.World
let owned: Array<{dispose: () => void}>
beforeEach(() => {
  world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  owned = []
})
afterEach(() => {
  world.free()
  for (const geometry of owned) {
    geometry.dispose()
  }
})
function plant(kind: DestructiblePlantKind, id = kind as string, x = 0) {
  const specimen = destructiblePlants.find(candidate => candidate.id === kind)!
  const geometry = new DestructiblePlantGeometry(kind)
  const potGeometry = new PotGeometry(specimen.pot)
  owned.push(geometry, potGeometry)
  const definition = potDefinition(specimen.pot)
  const center = definition.height / 2
  const yaw = new Quaternion
  yaw.setFromAxisAngle(new Vector3(0, 1, 0), 0.47)
  const attachments = new PlantAttachment(geometry.leaves.map(leaf => `${id}-${leaf.id}`))
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, center, 0).setRotation(yaw).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.convexHull(potGeometry.vertices)!.setTranslation(0, -center, 0).setMass(3.8), body)
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.015, definition.soilRadius).setTranslation(0, definition.soilHeight - 0.015 - center, 0).setMass(0.8), body)
  for (const collider of geometry.stemColliders) {
    world.createCollider(RAPIER.ColliderDesc.convexHull(collider.vertices)!.setTranslation(0, definition.soilHeight - center, 0).setEnabled(false).setMass(collider.mass), body)
  }
  const pot = new GrabbableBody(body, world, {
    canGrab: attachments.canGrabPot,
    onAttachmentChange: attachments.setPotAttached,
  })
  pot.rememberHome()
  const leaves = geometry.leaves.map(leaf => {
    const position = new Vector3(...leaf.position)
    position.add(new Vector3(0, definition.soilHeight, 0)).applyQuaternion(yaw).add(new Vector3(x, 0, 0))
    const leafRotation = new Quaternion
    const rotation = yaw.clone().multiply(leafRotation.setFromEuler(new Euler(...leaf.rotation)))
    const leafBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(rotation).setCcdEnabled(true).setGravityScale(leafPhysics.gravityScale).setLinearDamping(leafPhysics.linearDamping).setAngularDamping(leafPhysics.angularDamping))
    world.createCollider(RAPIER.ColliderDesc.convexHull(leaf.vertices)!.setEnabled(false).setMass(leaf.mass), leafBody)
    if (leaf.stemVertices) {
      world.createCollider(RAPIER.ColliderDesc.convexHull(leaf.stemVertices)!.setEnabled(false).setMass(leaf.stemMass), leafBody)
    }
    const controller = new GrabbableBody(leafBody, world, {
      onAttachmentChange: attached => attachments.setLeafAttached(`${id}-${leaf.id}`, attached),
      recoverAsDynamic: attachments.recoverLeafAsDynamic,
    })
    controller.rememberHome()
    return controller
  })
  world.step()
  return {
    attachments,
    geometry,
    leaves,
    pot,
  }
}
function pluckAll(leaves: Array<GrabbableBody>) {
  for (const [i, leaf] of leaves.entries()) {
    expect(leaf.grab()).toBe(true)
    leaf.release([10 + i, 2, -1], [10 + i, 2, 0], false)
  }
}
describe('destructible botanical models', () => {
  test('collider initialization respects an existing body’s attachment state', () => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.1), body)
    initializeFoliageCollider(collider)
    expect(collider.isEnabled()).toBe(false)
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    initializeFoliageCollider(collider)
    expect(collider.isEnabled()).toBe(true)
    body.setBodyType(RAPIER.RigidBodyType.Fixed, true)
    initializeFoliageCollider(collider)
    expect(collider.isEnabled()).toBe(false)
    expect(() => initializeFoliageCollider(null)).not.toThrow()
  })
  test.each([['birdOfParadise', 9, 2500], ['peaceLily', 13, 3600]] as const)('%s has distinct, finite, low-poly detachable pieces', (kind, count, budget) => {
    const geometry = new DestructiblePlantGeometry(kind)
    const repeat = new DestructiblePlantGeometry(kind)
    owned.push(geometry, repeat)
    expect(geometry.leaves).toHaveLength(count)
    const leafIds = new Set(geometry.leaves.map(leaf => leaf.id))
    expect(leafIds.size).toBe(count)
    const leafShapeHashes = new Set(geometry.leaves.map(leaf => Bun.hash(leaf.vertices)))
    expect(leafShapeHashes.size).toBeGreaterThan(3)
    expect(geometry.triangles).toBeLessThan(budget)
    expect(geometry.triangles).toBe(triangleCount(geometry.stems) + geometry.leaves.reduce((sum, leaf) => sum + triangleCount(leaf.geometry) + triangleCount(leaf.stem), 0))
    expect(geometry.leaves.some(leaf => !leaf.stem)).toBe(true)
    expect(geometry.leaves.some(leaf => leaf.stem)).toBe(true)
    for (const [i, leaf] of geometry.leaves.entries()) {
      expect(leaf.vertices).toEqual(repeat.leaves[i].vertices)
      expect(geometry.stemColliders[i].vertices).toEqual(repeat.stemColliders[i].vertices)
      expect(leaf.vertices).toEqual(Float32Array.from(leaf.geometry.getAttribute('position').array))
      expect(leaf.geometry.getAttribute('color').count).toBe(leaf.geometry.getAttribute('position').count)
      expect(leaf.mass).toBeGreaterThan(0)
      for (const part of [leaf.geometry, leaf.stem]) {
        if (part === null) {
          continue
        }
        expect(part.index).not.toBeNull()
        for (const attribute of Object.values(part.attributes)) {
          expect([...attribute.array].every(Number.isFinite)).toBe(true)
        }
      }
      expect([...geometry.stemColliders[i].vertices].every(Number.isFinite)).toBe(true)
    }
    expect(geometry.leaves.filter(leaf => leaf.title.includes('flower'))).toHaveLength(kind === 'peaceLily' ? 3 : 0)
  })
  test('interactive models fit below gallery ceilings', () => {
    for (const specimen of destructiblePlants) {
      const geometry = new DestructiblePlantGeometry(specimen.id)
      owned.push(geometry)
      const bounds = geometry.stems.boundingBox!.clone()
      for (const leaf of geometry.leaves) {
        const leafRotation = new Quaternion
        const transform = new Matrix4
        transform.compose(new Vector3(...leaf.position), leafRotation.setFromEuler(new Euler(...leaf.rotation)), new Vector3(1, 1, 1))
        bounds.union(leaf.geometry.boundingBox!.clone().applyMatrix4(transform))
        if (leaf.stem) {
          bounds.union(leaf.stem.boundingBox!.clone().applyMatrix4(transform))
        }
      }
      bounds.translate(new Vector3(0, potDefinition(specimen.pot).soilHeight, 0))
      expect(bounds.min.x).toBeGreaterThan(-7)
      expect(bounds.max.x).toBeLessThan(7)
      expect(bounds.max.y).toBeLessThan(2.7)
      expect(bounds.max.z).toBeLessThan(6.2)
    }
  })
  test.each(['birdOfParadise', 'peaceLily'] as const)('%s releases every owned buffer', kind => {
    const geometry = new DestructiblePlantGeometry(kind)
    const parts = [
      geometry.stems,
      ...geometry.leaves.flatMap(leaf => {
        return leaf.stem ? [leaf.geometry, leaf.stem] : [leaf.geometry]
      }),
    ]
    let disposed = 0
    for (const part of parts) {
      part.addEventListener('dispose', () => disposed++)
    }
    geometry.dispose()
    expect(disposed).toBe(parts.length)
  })
})
for (const kind of ['birdOfParadise', 'peaceLily'] as const) {
  describe(`${kind} destruction`, () => {
    test('settled attached foliage clears its pot before the first pluck', () => {
      const {leaves} = plant(kind)
      for (let i = 0; i < 120; i++) {
        world.step()
      }
      for (const leaf of leaves) {
        const p = leaf.body.translation()
        expect(leaf.placement.hasRoom([p.x, p.y, p.z], false)).toBe(true)
        expect(leaf.body.isFixed()).toBe(true)
        for (let i = 0; i < leaf.body.numColliders(); i++) {
          expect(leaf.body.collider(i).isEnabled()).toBe(false)
        }
      }
    })
    test('dropped plucks stay detached, re-grabs stay loose and only their own pot unlocks', () => {
      const first = plant(kind, 'first')
      const second = plant(kind, 'second', 4)
      const {attachments, leaves, pot} = first
      expect(pot.grab()).toBe(false)
      const leaf = leaves[1]
      expect(leaf.grab()).toBe(true)
      expect(attachments.remaining).toBe(leaves.length - 1)
      expect(leaf.release([0, 2, 2], [0, 2, 3], false)).toBe(true)
      expect(leaf.body.translation().z).toBeCloseTo(3)
      expect(leaf.body.isDynamic()).toBe(true)
      expect(attachments.remaining).toBe(leaves.length - 1)
      pluckAll(leaves)
      expect(attachments.canGrabPot()).toBe(true)
      expect(second.pot.grab()).toBe(false)
      leaf.grab()
      leaf.release([0, 2, 2], [0, 2, 3], false)
      attachments.setLeafAttached('second-leaf-0', false)
      expect(attachments.remaining).toBe(0)
      expect(leaf.body.isDynamic()).toBe(true)
      expect(pot.grab()).toBe(true)
    })
    test('leaves and carried stalks become a single throwable compound body and land on the floor', () => {
      const {geometry, leaves} = plant(kind)
      world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.1, 40).setTranslation(0, -0.1, 0))
      const leaf = leaves[1]
      expect(leaf.body.numColliders()).toBe(2)
      leaf.grab()
      leaf.release([0, 2, 2], [0, 2, 3], true)
      expect(leaf.body.isDynamic()).toBe(true)
      expect(leaf.body.linvel().z).toBeCloseTo(launchSpeed(itemMass(leaf.body)), 5)
      for (let i = 0; i < leaf.body.numColliders(); i++) {
        expect(leaf.body.collider(i).isEnabled()).toBe(true)
      }
      world.step()
      expect(leaf.body.mass()).toBeCloseTo(geometry.leaves[1].mass + geometry.leaves[1].stemMass, 5)
      for (let i = 0; i < 360; i++) {
        world.step()
      }
      expect(leaf.body.translation().z).toBeGreaterThan(3)
      expect(leaf.body.translation().y).toBeGreaterThan(-0.1)
      expect(leaf.body.translation().y).toBeLessThan(0.8)
    })
    test('empty pots carry their remaining stems without dragging loose leaves', () => {
      const {geometry, leaves, pot} = plant(kind)
      pluckAll(leaves)
      const positions = leaves.map(leaf => leaf.body.translation())
      pot.grab()
      pot.release([0, 2, 2], [0, 2, 3], true)
      expect(pot.body.isDynamic()).toBe(true)
      expect(pot.body.numColliders()).toBe(geometry.leaves.length + 2)
      expect(leaves.map(leaf => leaf.body.translation())).toEqual(positions)
      world.step()
      expect(pot.body.mass()).toBeCloseTo(4.6 + geometry.stemColliders.reduce((sum, collider) => sum + collider.mass, 0), 4)
      for (let i = 0; i < pot.body.numColliders(); i++) {
        expect(pot.body.collider(i).isEnabled()).toBe(true)
      }
    })
    test('carried stalks participate in held clearance, not just their leaf heads', () => {
      const {geometry, leaves} = plant(kind)
      const leaf = leaves[1]
      const definition = geometry.leaves[1]
      const position = leaf.body.translation()
      const rotation = leaf.body.rotation()
      const head = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(rotation))
      world.createCollider(RAPIER.ColliderDesc.convexHull(definition.vertices)!.setEnabled(false), head)
      const headOnly = new GrabbableBody(head, world)
      const point = definition.stem!.boundingBox!.getCenter(new Vector3).applyQuaternion(new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)).add(new Vector3(position.x, position.y, position.z))
      world.createCollider(RAPIER.ColliderDesc.ball(0.003).setTranslation(point.x, point.y, point.z))
      world.step()
      expect(headOnly.placement.hasRoom([position.x, position.y, position.z])).toBe(true)
      expect(leaf.placement.hasRoom([position.x, position.y, position.z])).toBe(false)
    })
    test('remaining stems participate in pot clearance while their colliders are disabled', () => {
      const {geometry, leaves, pot} = plant(kind)
      pluckAll(leaves)
      const collider = pot.body.collider(2)
      const vertices = geometry.stemColliders[0].vertices
      let top = 0
      for (let i = 3; i < vertices.length; i += 3) {
        if (vertices[i + 1] > vertices[top + 1]) {
          top = i
        }
      }
      const rotation = pot.body.rotation()
      const translation = pot.body.translation()
      const offset = collider.translationWrtParent()!
      const point = new Vector3
      point.fromArray(vertices, top).add(new Vector3(offset.x, offset.y, offset.z)).applyQuaternion(new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)).add(new Vector3(translation.x, translation.y, translation.z))
      const obstacle = world.createCollider(RAPIER.ColliderDesc.ball(0.015).setTranslation(point.x, point.y, point.z))
      world.step()
      const position = pot.body.translation()
      expect(collider.isEnabled()).toBe(false)
      expect(pot.placement.hasRoom([position.x, position.y, position.z])).toBe(false)
      obstacle.setEnabled(false)
      expect(pot.placement.hasRoom([position.x, position.y, position.z])).toBe(true)
    })
    test('a quiet pot release detaches it locally without moving loose leaves', () => {
      const {attachments, leaves, pot} = plant(kind)
      pluckAll(leaves)
      const loose = leaves.map(leaf => leaf.body.translation())
      pot.grab()
      expect(pot.body.isEnabled()).toBe(false)
      expect(pot.release([0, 2, 2], [0, 2, 3], false)).toBe(true)
      expect(pot.body.translation().z).toBeCloseTo(3)
      expect(pot.body.isDynamic()).toBe(true)
      expect(attachments.potAttached).toBe(false)
      expect(leaves.map(leaf => leaf.body.translation())).toEqual(loose)
      expect(Array.from({length: pot.body.numColliders()}, (_, i) => pot.body.collider(i).isEnabled()).every(Boolean)).toBe(true)
    })
    test('released pots land on the floor and lost pots recover empty without replanting leaves', () => {
      const {attachments, leaves, pot} = plant(kind)
      pluckAll(leaves)
      const original = pot.body.translation()
      const handle = pot.body.handle
      world.createCollider(RAPIER.ColliderDesc.cuboid(40, 0.1, 40).setTranslation(0, -0.1, 0))
      pot.grab()
      pot.release([0, 2, 3], [0, 2, 4], false)
      for (let i = 0; i < 360; i++) {
        world.step()
      }
      expect(pot.body.translation().y).toBeGreaterThan(0)
      expect(pot.body.translation().y).toBeLessThan(0.6)
      const loose = leaves.map(leaf => leaf.body.translation())
      pot.body.setTranslation({
        x: 0,
        y: -13,
        z: 5,
      }, true)
      pot.recover()
      expect(pot.body.translation()).toEqual(original)
      expect(pot.body.handle).toBe(handle)
      expect(attachments.potAttached).toBe(true)
      expect(attachments.remaining).toBe(0)
      expect(leaves.map(leaf => leaf.body.translation())).toEqual(loose)
      expect(pot.grab()).toBe(true)
    })
    test('lost leaves reattach only while their pot remains anchored', () => {
      const {attachments, leaves, pot} = plant(kind)
      pluckAll(leaves)
      const leaf = leaves[0]
      const handle = leaf.body.handle
      leaf.body.setTranslation({
        x: 0,
        y: -13,
        z: 0,
      }, true)
      leaf.recover()
      expect(leaf.body.isFixed()).toBe(true)
      expect(attachments.remaining).toBe(1)
      expect(pot.grab()).toBe(false)
      leaf.grab()
      leaf.release([10, 2, -1], [10, 2, 0], false)
      pot.grab()
      pot.release([0, 2, 3], [0, 2, 4], false)
      leaf.body.setTranslation({
        x: 0,
        y: -13,
        z: 0,
      }, true)
      leaf.recover()
      expect(leaf.body.isDynamic()).toBe(true)
      expect(leaf.body.collider(0).isEnabled()).toBe(true)
      expect(attachments.remaining).toBe(0)
      expect(leaf.body.handle).toBe(handle)
    })
  })
}
