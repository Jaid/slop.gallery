import {expect, mock, spyOn, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {knotSign, knotSignId, knotSignParts, knotSignRoundParts} from 'knot-materials/signs.ts'
import {BoxGeometry, Euler, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import GrabbableBody from '../../src/lib/physics/GrabbableBody.ts'
import InstancedPropVisuals from '../../src/lib/physics/InstancedPropVisuals.ts'
import {throwSpeed, throwSpeedFor} from '../../src/lib/physics/throwMotion.ts'

await RAPIER.init()
test('a complete nameplate can be picked up, canceled, thrown and picked up again', () => {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.1, 30).setTranslation(0, -0.1, 0))
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, knotSign.elevation, 0).setCcdEnabled(true).setLinearDamping(0.1).setAngularDamping(0.15))
  for (const {size, position, rotation = [0, 0, 0]} of knotSignParts) {
    const plateRotation = new Quaternion
    world.createCollider(RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...position).setRotation(plateRotation.setFromEuler(new Euler(...rotation))).setMass(knotSign.plateMass).setFriction(0.9).setRestitution(0.1), body)
  }
  for (const {radius, height, position, rotation = [0, 0, 0], mass} of knotSignRoundParts) {
    const roundPartRotation = new Quaternion
    world.createCollider(RAPIER.ColliderDesc.cylinder(height / 2, radius).setTranslation(...position).setRotation(roundPartRotation.setFromEuler(new Euler(...rotation))).setMass(mass).setFriction(0.9).setRestitution(0.1), body)
  }
  const carried = new GrabbableBody(body, world)
  try {
    for (let i = 0; i < 300; i++) {
      world.step()
    }
    expect(body.translation().y).toBeCloseTo(knotSign.elevation, 2)
    expect(body.mass()).toBeCloseTo(knotSign.plateMass * knotSignParts.length + knotSignRoundParts.reduce((mass, part) => mass + part.mass, 0))
    const resting = body.translation()
    const rotation = body.rotation()
    body.sleep()
    expect(carried.grab()).toBe(true)
    expect(body.isEnabled()).toBe(false)
    for (let i = 0; i < 90; i++) {
      world.step()
    }
    carried.cancel()
    expect(body.translation()).toEqual(resting)
    expect(body.rotation()).toEqual(rotation)
    expect(body.isDynamic()).toBe(true)
    expect(carried.grab()).toBe(true)
    expect(carried.release([0, 1.5, 1], [0, 1.5, 2], {throwing: true})).toBeDefined()
    // A nameplate is twice as heavy as an orb, so it leaves slower and tumbles slower.
    const speed = throwSpeedFor(body.mass())
    expect(speed).toBeLessThan(throwSpeed)
    expect(body.linvel().z).toBeCloseTo(speed, 5)
    expect(body.angvel().x).toBeCloseTo(3 * speed / throwSpeed, 5)
    // Rapier reports colliders as their body left them until its next step.
    world.step()
    for (let i = 0; i < body.numColliders(); i++) {
      expect(body.collider(i).isEnabled()).toBe(true)
    }
    for (let i = 0; i < 600; i++) {
      world.step()
    }
    expect(body.translation().z).toBeGreaterThan(3)
    expect(body.translation().y).toBeGreaterThan(-0.05)
    const landed = body.translation()
    expect(carried.grab()).toBe(true)
    for (let i = 0; i < 90; i++) {
      world.step()
    }
    carried.cancel()
    expect(body.translation()).toEqual(landed)
    expect(body.isDynamic()).toBe(true)
  } finally {
    world.free()
  }
})
test('instanced faces and supports follow prop transforms, even outside their original bounds', () => {
  const geometry = new BoxGeometry(1, 0.6, 0.03)
  const material = new MeshBasicMaterial
  const faces = new InstancedMesh(geometry, material, 2)
  const supports = new InstancedMesh(geometry, material, 2)
  const root = new Group
  root.position.set(5, 2, -3)
  root.rotation.y = 0.7
  root.add(faces, supports)
  const first = new Group
  const second = new Group
  const targets = new Map([[knotSignId('first'), first], [knotSignId('second'), second]])
  const visuals = new InstancedPropVisuals([faces, supports], targets.keys().toArray())
  try {
    for (const x of [0, 50, -100]) {
      first.position.set(x, 1.5, 8)
      first.rotation.set(0.8, 0.2, -0.3)
      second.position.set(3, 0.4, 4)
      visuals.update(id => targets.get(id))
      for (const mesh of [faces, supports]) {
        const matrix = new Matrix4
        mesh.getMatrixAt(0, matrix)
        const worldMatrix = new Matrix4
        worldMatrix.multiplyMatrices(mesh.matrixWorld, matrix)
        for (let i = 0; i < 16; i++) {
          expect(worldMatrix.elements[i]).toBeCloseTo(first.matrixWorld.elements[i], 4)
        }
        const instancePosition = new Vector3
        expect(mesh.boundingBox!.containsPoint(instancePosition.setFromMatrixPosition(matrix))).toBe(true)
      }
    }
    const version = faces.instanceMatrix.version
    visuals.update(id => targets.get(id))
    expect(faces.instanceMatrix.version).toBe(version)
    const proxy = new Mesh(geometry, material)
    proxy.visible = false
    first.add(proxy)
    first.position.set(0, 0, -2)
    first.rotation.set(0, 0, 0)
    first.updateMatrixWorld(true)
    const proxyRay = new Raycaster(new Vector3, new Vector3(0, 0, -1))
    expect(proxyRay.intersectObject(first, true)).not.toHaveLength(0)
  } finally {
    faces.dispose()
    supports.dispose()
    geometry.dispose()
    material.dispose()
  }
})
test('instanced layers resolve and update each source once, including replacement and missing props', () => {
  const geometry = new BoxGeometry
  const material = new MeshBasicMaterial
  const meshes = Array.from({length: 5}, () => new InstancedMesh(geometry, material, 1))
  const first = new Group
  const next = new Group
  first.position.x = 2
  next.position.x = 7
  const update = spyOn(first, 'updateWorldMatrix')
  const resolve = mock((): Group | undefined => first)
  const visuals = new InstancedPropVisuals(meshes, ['prop'])
  const matrix = new Matrix4
  try {
    visuals.update(resolve)
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    resolve.mockImplementation(() => next)
    visuals.update(resolve)
    for (const mesh of meshes) {
      mesh.getMatrixAt(0, matrix)
      expect(matrix.elements[12]).toBe(7)
    }
    const versions = meshes.map(mesh => mesh.instanceMatrix.version)
    resolve.mockImplementation(() => {})
    visuals.update(resolve)
    expect(meshes.map(mesh => mesh.instanceMatrix.version)).toEqual(versions)
  } finally {
    update.mockRestore()
    for (const mesh of meshes) {
      mesh.dispose()
    }
    geometry.dispose()
    material.dispose()
  }
})
