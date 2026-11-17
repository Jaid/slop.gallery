import type {DestructibleCatalogKind} from '../../src/lib/gallery/destructiblePlants/CatalogPlantGeometry.ts'
import type {BufferGeometry} from 'three/webgpu'

import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Vector3} from 'three/webgpu'

import CatalogPlantGeometry from '../../src/lib/gallery/destructiblePlants/CatalogPlantGeometry.ts'
import {potDefinition} from '../../src/lib/gallery/plantDecorations/catalog.ts'
import PlantGeometry from '../../src/lib/gallery/plantDecorations/PlantGeometry.ts'
import PotGeometry from '../../src/lib/gallery/plantDecorations/PotGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import RootedPlantAttachment from '../../src/lib/physics/RootedPlantAttachment.ts'

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
function fixture(kind: DestructibleCatalogKind) {
  const model = new CatalogPlantGeometry(kind)
  const potGeometry = new PotGeometry('atelier')
  owned.push(model, potGeometry)
  const definition = potDefinition('atelier')
  const soil = definition.soilHeight + 0.036
  const center = definition.height / 2
  const attachments = new RootedPlantAttachment(model.leaves.map(leaf => leaf.id))
  const potBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, center + 0.036, 0))
  world.createCollider(RAPIER.ColliderDesc.convexHull(potGeometry.vertices)!.setTranslation(0, -center, 0).setMass(3.8), potBody)
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.015, definition.soilRadius).setTranslation(0, definition.soilHeight - 0.015 - center, 0).setMass(0.8), potBody)
  const pot = new GrabbableBody(potBody, world, {
    canGrab: attachments.canGrabPot,
    onAttachmentChange: attachments.setPotAttached,
  })
  const midpoint = model.stems.boundingBox!.getCenter(new Vector3)
  const rootBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(midpoint.x, midpoint.y + soil, midpoint.z).setCcdEnabled(true))
  for (const collider of model.stemColliders) {
    world.createCollider(RAPIER.ColliderDesc.convexHull(collider.vertices)!.setTranslation(-midpoint.x, -midpoint.y, -midpoint.z).setEnabled(false).setMass(collider.mass), rootBody)
  }
  const root = new GrabbableBody(rootBody, world, {
    canGrab: attachments.canGrabRoot,
    onAttachmentChange: attachments.setRootAttached,
    recoverAsDynamic: attachments.recoverRootAsDynamic,
  })
  const leaves = model.leaves.map(leaf => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(leaf.position[0], leaf.position[1] + soil, leaf.position[2]).setCcdEnabled(true))
    world.createCollider(RAPIER.ColliderDesc.convexHull(leaf.vertices)!.setEnabled(false).setMass(leaf.mass), body)
    return new GrabbableBody(body, world, {
      onAttachmentChange: attached => attachments.setLeafAttached(leaf.id, attached),
      recoverAsDynamic: attachments.recoverLeafAsDynamic,
    })
  })
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.1, 50).setTranslation(0, -0.1, 0))
  world.step()
  for (const controller of [pot, root, ...leaves]) {
    controller.rememberHome()
  }
  return {
    model,
    attachments,
    leaves,
    root,
    pot,
  }
}
function clearLeaves(leaves: Array<GrabbableBody>) {
  for (const [i, leaf] of leaves.entries()) {
    expect(leaf.grab()).toBe(true)
    leaf.release([3 + i * 0.5, 2, 3], [3 + i * 0.5, 2, 4], false)
    expect(leaf.body.isDynamic()).toBe(true)
  }
}
function values(geometry: BufferGeometry, name: string) {
  return [...geometry.getAttribute(name).array]
}
describe('existing specimen geometry', () => {
  test.each([['snake', 15], ['calathea', 13]] as const)('%s retains every visible triangle, attribute and leaf', (kind, count) => {
    const source = new PlantGeometry(kind)
    const model = new CatalogPlantGeometry(kind)
    owned.push(source, model)
    expect(model.leaves).toHaveLength(count)
    expect(model.triangles).toBe(triangleCount(source.foliage) + triangleCount(source.stems))
    expect(model.stems.index!.array).toEqual(source.stems.index!.array)
    for (const name of Object.keys(source.stems.attributes)) {
      expect(model.stems.getAttribute(name).array).toEqual(source.stems.getAttribute(name).array)
    }
    for (const name of ['normal', 'color', 'uv']) {
      expect(model.leaves.flatMap(leaf => values(leaf.geometry, name))).toEqual(values(source.foliage, name))
    }
    const positions = model.leaves.flatMap(leaf => values(leaf.geometry, 'position').map((value, i) => value + leaf.position[i % 3]))
    const original = values(source.foliage, 'position')
    expect(positions).toHaveLength(original.length)
    expect(Math.max(...positions.map((value, i) => Math.abs(value - original[i])))).toBeLessThan(0.000001)
    let offset = 0
    const indices = model.leaves.flatMap(leaf => {
      const result = [...leaf.geometry.index!.array].map(index => index + offset)
      offset += leaf.geometry.getAttribute('position').count
      return result
    })
    expect(indices).toEqual([...source.foliage.index!.array])
    expect(model.removableRoot).toBe(true)
    expect(model.foliageMaterial).toBe('foliage')
    expect(model.stemMaterial).toBe('stems')
  })
  test.each(['snake', 'calathea'] as const)('%s disposes all owned meshes exactly once', kind => {
    const model = new CatalogPlantGeometry(kind)
    const parts = [model.stems, ...model.leaves.map(leaf => leaf.geometry)]
    const counts = parts.map(() => 0)
    for (const [i, part] of parts.entries()) {
      part.addEventListener('dispose', () => counts[i]++)
    }
    model.dispose()
    expect(counts.every(count => count === 1)).toBe(true)
  })
})
describe('catalog plant destruction', () => {
  test.each(['snake', 'calathea'] as const)('%s enforces leaves → root → pot and cancel restores each stage', kind => {
    const {leaves, root, pot, attachments} = fixture(kind)
    const state = attachments
    expect(root.grab()).toBe(false)
    expect(pot.grab()).toBe(false)
    clearLeaves(leaves.slice(0, -1))
    expect(root.grab()).toBe(false)
    clearLeaves([leaves.at(-1)!])
    expect(pot.grab()).toBe(false)
    expect(root.grab()).toBe(true)
    expect(state.canGrabPot()).toBe(true)
    root.cancel()
    expect(state.rootAttached).toBe(true)
    expect(pot.grab()).toBe(false)
    expect(root.grab()).toBe(true)
    root.release([0, 2, 3], [0, 2, 4], true)
    expect(root.body.isDynamic()).toBe(true)
    root.grab()
    root.cancel()
    expect(state.rootAttached).toBe(false)
    expect(pot.grab()).toBe(true)
    pot.cancel()
    expect(state.potAttached).toBe(true)
    expect(state.rootAttached).toBe(false)
  })
  test.each(['snake', 'calathea'] as const)('%s root and loose leaves remain independent when the pot moves', kind => {
    const {model, leaves, root, pot} = fixture(kind)
    clearLeaves(leaves)
    root.grab()
    root.release([0, 2, 3], [0, 2, 4], true)
    const positions = [root, ...leaves].map(piece => piece.body.translation())
    pot.grab()
    pot.release([-3, 2, 3], [-3, 2, 4], true)
    expect([root, ...leaves].map(piece => piece.body.translation())).toEqual(positions)
    expect(pot.body.numColliders()).toBe(2)
    expect(root.body.numColliders()).toBe(model.stemColliders.length)
    world.step()
    expect(root.body.mass()).toBeCloseTo(model.stemColliders.reduce((sum, collider) => sum + collider.mass, 0), 5)
    for (let i = 0; i < 360; i++) {
      world.step()
    }
    expect(root.body.translation().y).toBeGreaterThan(-0.1)
    expect(root.body.translation().y).toBeLessThan(1)
  })
  test.each(['snake', 'calathea'] as const)('%s root recovery relocks an anchored pot, but never reattaches after the pot moves', kind => {
    const {leaves, root, pot, attachments} = fixture(kind)
    const state = attachments
    clearLeaves(leaves)
    root.grab()
    root.release([0, 2, 3], [0, 2, 4], false)
    leaves[0].body.setTranslation({
      x: 0,
      y: -13,
      z: 0,
    }, true)
    leaves[0].recover()
    expect(leaves[0].body.isDynamic()).toBe(true)
    root.body.setTranslation({
      x: 0,
      y: -13,
      z: 0,
    }, true)
    root.recover()
    expect(root.body.isFixed()).toBe(true)
    expect(state.rootAttached).toBe(true)
    expect(pot.grab()).toBe(false)
    root.grab()
    root.release([0, 2, 3], [0, 2, 4], false)
    pot.grab()
    pot.release([-3, 2, 3], [-3, 2, 4], false)
    root.body.setTranslation({
      x: 0,
      y: -13,
      z: 0,
    }, true)
    root.recover()
    expect(root.body.isDynamic()).toBe(true)
    expect(state.rootAttached).toBe(false)
    expect(state.canGrabPot()).toBe(true)
  })
  test.each(['snake', 'calathea'] as const)('%s lets go of the root away from the pot it grew in, still stopping at other obstacles', kind => {
    const {leaves, root, pot, attachments} = fixture(kind)
    clearLeaves(leaves)
    const home = root.body.translation()
    // Attached, the root sits inside its pot; carried out of the physics and let go of elsewhere, it never has to be pulled out of it.
    expect(root.placement.hasRoom([home.x, home.y, home.z])).toBe(false)
    root.grab()
    expect(root.release([0, 2, 2], [0, 2, 3], false)).not.toBeNull()
    expect(root.body.translation().z).toBeCloseTo(3, 6)
    expect(root.body.isDynamic()).toBe(true)
    expect(root.body.collider(0).isEnabled()).toBe(true)
    expect(pot.body.collider(0).isEnabled()).toBe(true)
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 2, 0.1).setTranslation(0, 2, 4))
    world.step()
    root.grab()
    expect(root.release([0, 2, 2], [0, 2, 5], false)).not.toBeNull()
    const stopped = root.body.translation()
    expect(stopped.z).toBeLessThan(3.9)
    expect(root.placement.hasRoom([stopped.x, stopped.y, stopped.z])).toBe(true)
    // A loose root still fits nowhere inside its former pot.
    expect(root.placement.hasRoom([home.x, home.y, home.z], false)).toBe(false)
    root.grab()
    root.cancel()
    expect(attachments.remaining).toBe(0)
  })
  test('fresh attachment state resets all three stages and foreign leaf IDs are ignored', () => {
    const state = new RootedPlantAttachment(['a', 'b'])
    state.setLeafAttached('foreign', false)
    expect(state.remaining).toBe(2)
    state.setLeafAttached('a', false)
    state.setLeafAttached('b', false)
    state.setRootAttached(false)
    state.setPotAttached(false)
    const reset = new RootedPlantAttachment(['a', 'b'])
    expect(reset.remaining).toBe(2)
    expect(reset.rootAttached).toBe(true)
    expect(reset.potAttached).toBe(true)
    expect(reset.canGrabRoot()).toBe(false)
    expect(reset.canGrabPot()).toBe(false)
  })
})
