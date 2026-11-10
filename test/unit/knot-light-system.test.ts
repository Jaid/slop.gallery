import type {KnotLightImpact} from '../../src/lib/physics/KnotLightImpacts.ts'

import {expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import KnotLightPanels, {knotLightDiffuserContactSkin, knotLightDiffuserSize, knotLightDiffuserY, knotLightHousingSize, knotLightHousingY} from 'knot-materials/KnotLightPanels.ts'
import KnotLightDamage, {knotLightFracture} from 'knot-materials/KnotLights.ts'
import {Matrix4} from 'three/webgpu'

import KnotLightImpacts from '../../src/lib/physics/KnotLightImpacts.ts'
import {beginBodyThrow} from '../../src/lib/physics/ThrowState.ts'

await RAPIER.init()
test('the exposed emitter hangs under its housing without overlapping it and glows untouched by tone mapping', () => {
  const panels = new KnotLightPanels([{
    id: '0:0',
    position: [0, 5, 0],
    row: 0,
    slot: 0,
  }])
  try {
    expect(knotLightDiffuserY + knotLightDiffuserSize[1] / 2).toBeLessThan(knotLightHousingY - knotLightHousingSize[1] / 2)
    expect(panels.diffuserMaterial.toneMapped).toBe(false)
    expect(panels.diffuserMaterial.transparent).toBe(false)
  } finally {
    panels.dispose()
  }
})
test('fractures, flicker and detachment update only their own instance, and a reset creates pristine faces', () => {
  const slots = [0, 1].map(slot => ({
    id: `0:${slot}`,
    position: [slot * 3, 5, 0] as [number, number, number],
    row: 0,
    slot,
  }))
  const panels = new KnotLightPanels(slots)
  const reset = new KnotLightPanels(slots)
  try {
    const fracture = knotLightFracture([0.25, -0.3], [1, 2])
    panels.fracture(0, fracture)
    panels.setIntensity(0, 0.45)
    expect(panels.fractures.getW(0)).toBe(1)
    expect(panels.fractures.getW(1)).toBe(0)
    expect(panels.liveFractions[0]).toBeCloseTo(fracture.liveFraction)
    expect(panels.intensities.getX(0)).toBeCloseTo(0.45)
    expect(panels.intensities.getX(1)).toBe(1)
    panels.break(0)
    expect(panels.intensities.getX(0)).toBe(0)
    expect(panels.liveFractions[0]).toBe(0)
    const matrix = new Matrix4
    panels.diffusers.getMatrixAt(0, matrix)
    expect(matrix.determinant()).toBe(0)
    panels.housings.getMatrixAt(0, matrix)
    expect(matrix.determinant()).toBe(1)
    expect([...reset.liveFractions]).toEqual([1, 1])
    expect([...reset.fractures.array]).toEqual(Array.from({length: 8}, () => 0))
    expect([...reset.intensities.array]).toEqual([1, 1])
  } finally {
    panels.dispose()
    reset.dispose()
  }
})
test('real CCD impacts use incoming motion, accept ordinary props and deduplicate compound contacts', () => {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  try {
    const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 5, 0))
    const face = world.createCollider(RAPIER.ColliderDesc.cuboid(1.14, 0.012, 1.04).setTranslation(0, -0.04, 0).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), fixed)
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.28, 0.05, 1.18).setTranslation(0, 0.025, 0), fixed)
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0.25, 3, -0.3).setCcdEnabled(true).setLinvel(0, 10, 0))
    world.createCollider(RAPIER.ColliderDesc.ball(0.2).setMass(1.8), body)
    const damage = new KnotLightDamage(1)
    const impacts = new KnotLightImpacts
    const hits: Array<KnotLightImpact> = []
    impacts.register(face, 0)
    beginBodyThrow(body)
    for (let step = 0; step < 60; step++) {
      impacts.capture(world)
      world.step()
      impacts.collect(world, (index, impact) => {
        if (damage.hit(index, impact.mass, impact.speed, step / 60, impact.attackId)) {
          hits.push(impact)
        }
        expect(damage.hit(index, impact.mass, impact.speed, step / 60 + 1, impact.attackId)).toBe(false)
      })
    }
    expect(hits).toHaveLength(1)
    expect(hits[0].mass).toBeCloseTo(1.8)
    expect(hits[0].speed).toBeGreaterThan(6)
    expect(hits[0].point.x).toBeCloseTo(0.25, 2)
    expect(hits[0].point.z).toBeCloseTo(-0.3, 2)
    expect(damage.stage(0)).toBe(1)
    // A second deliberate throw is a new attack even when several physics steps
    // run before the application renders again.
    body.setTranslation({
      x: 0.25,
      y: 3,
      z: -0.3,
    }, true)
    body.setLinvel({
      x: 0,
      y: 10,
      z: 0,
    }, true)
    beginBodyThrow(body)
    for (let frame = 0; frame < 15; frame++) {
      for (let substep = 0; substep < 4; substep++) {
        impacts.capture(world)
        world.step()
        impacts.collect(world, (index, impact) => {
          damage.hit(index, impact.mass, impact.speed, 2 + (frame * 4 + substep) / 60, impact.attackId)
        })
      }
    }
    expect(damage.stage(0)).toBe(2)
    expect(damage.intensity(0, 4)).toBe(0)
    // Detachment leaves the backing solid, and the thin CCD diffuser settles on the floor.
    world.removeCollider(face, true)
    world.removeRigidBody(body)
    const debris = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 4.96, 0).setCcdEnabled(true))
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.14, 0.012, 1.04).setMass(0.35).setContactSkin(knotLightDiffuserContactSkin), debris)
    world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.1, 5).setTranslation(0, -0.1, 0), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()))
    for (let step = 0; step < 240; step++) {
      world.step()
    }
    expect(debris.translation().y).toBeGreaterThan(-0.05)
    expect(debris.translation().y).toBeLessThan(0.1)
    expect(fixed.numColliders()).toBe(1)
  } finally {
    world.free()
  }
})
