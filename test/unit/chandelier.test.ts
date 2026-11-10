import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Quaternion, Vector3} from 'three/webgpu'

import ChandelierGeometry from '../../src/lib/gallery/ChandelierGeometry.ts'
import HammeredBrassMaterial from '../../src/lib/materials/HammeredBrassMaterial.ts'
import {chandelierCanopyTop, chandelierPhysics, chandelierRod} from '../../src/lib/physics/chandelier.ts'

await RAPIER.init()
test('the chandelier’s brass is polished metal with hammering and patina', () => {
  const material = new HammeredBrassMaterial
  try {
    expect(material.metalness).toBe(1)
    expect(material.metalnessNode).not.toBeNull()
    expect(material.colorNode).not.toBeNull()
    expect(material.roughnessNode).not.toBeNull()
    expect(material.normalNode).not.toBeNull()
    expect(material.envMap).not.toBeNull()
  } finally {
    material.dispose()
  }
})
/** How far a projectile of `mass` swings the fixture out at most, hung from its canopy or from a rod `rod` meters long over it, and, with `canopy`, how far its canopy moves sideways at most, checking that it settles within `settle` seconds. */
function simulate(mass: number, miss = false, fixture = chandelierPhysics, {canopy, rod = 0, settle = 45}: {
  canopy?: {
    peak: number
  }
  rod?: number
  settle?: number
} = {}) {
  const geometry = new ChandelierGeometry({rod})
  const pivot = rod > 0 ? [0, chandelierCanopyTop + rod, 0] as const : fixture.anchor
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 120
  const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, fixture.height + pivot[1], 0))
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, fixture.height, 0).setAngularDamping(fixture.angularDamping).setLinearDamping(fixture.linearDamping).setCcdEnabled(true).setCanSleep(false).setAdditionalSolverIterations(8))
  world.createCollider(RAPIER.ColliderDesc.ball(0.21).setMass(fixture.hubMass), body)
  world.createCollider(RAPIER.ColliderDesc.ball(0.12).setTranslation(0, -0.38, 0).setMass(fixture.pendantMass), body)
  world.createCollider(RAPIER.ColliderDesc.cylinder((fixture.anchor[1] - 0.05) / 2, 0.022).setTranslation(0, (fixture.anchor[1] + 0.15) / 2, 0).setMass(fixture.stemMass), body)
  if (rod > 0) {
    world.createCollider(RAPIER.ColliderDesc.cylinder((rod - 0.1) / 2, chandelierRod.radius).setTranslation(0, chandelierCanopyTop + (rod - 0.1) / 2, 0).setMass(fixture.rodMass), body)
    for (const {radius, y} of geometry.knops) {
      world.createCollider(RAPIER.ColliderDesc.ball(radius).setTranslation(0, y, 0).setMass(fixture.knopMass), body)
    }
  }
  for (const vertices of geometry.armColliders) {
    world.createCollider(RAPIER.ColliderDesc.convexHull(vertices)!.setMass(fixture.armMass).setRestitution(0.15), body)
  }
  for (const vertices of geometry.ringColliders) {
    world.createCollider(RAPIER.ColliderDesc.convexHull(vertices)!.setMass(fixture.ringMass).setRestitution(0.15), body)
  }
  world.createImpulseJoint(RAPIER.JointData.spherical(new Vector3, new Vector3(...pivot)), anchor, body, true)
  const offset = () => Math.hypot(body.translation().x, body.translation().z)
  try {
    for (let i = 0; i < 120; i++) {
      world.step()
    }
    expect(offset()).toBeLessThan(0.001)
    const projectile = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(miss ? 3 : 1.25, fixture.height + 0.27, 2.5).setLinvel(0, 0, -10).setGravityScale(0).setCcdEnabled(true))
    world.createCollider(RAPIER.ColliderDesc.ball(0.23).setMass(mass), projectile)
    let peak = 0
    let drift = 0
    for (let i = 0; i < 120 * 8; i++) {
      world.step()
      peak = Math.max(peak, offset())
      const q = body.rotation()
      const p = body.translation()
      const turn = new Quaternion(q.x, q.y, q.z, q.w)
      const pin = new Vector3(...pivot)
      pin.applyQuaternion(turn).add(new Vector3(p.x, p.y, p.z))
      drift = Math.max(drift, pin.distanceTo(new Vector3(0, fixture.height + pivot[1], 0)))
      if (!canopy) {
        continue
      }
      const top = new Vector3(0, chandelierCanopyTop, 0)
      top.applyQuaternion(turn).add(new Vector3(p.x, p.y, p.z))
      canopy.peak = Math.max(canopy.peak, Math.hypot(top.x, top.z))
    }
    expect(drift).toBeLessThan(0.012)
    for (let i = 0; i < 120 * settle; i++) {
      world.step()
    }
    expect(offset()).toBeLessThan(0.015)
    return peak
  } finally {
    world.free()
    geometry.dispose()
  }
}
describe('suspended Sienna chandelier', () => {
  test('a thrown sculpture swings it, a heavier pot swings it farther and damping settles it', () => {
    const light = simulate(1.8)
    const heavy = simulate(5)
    expect(light).toBeGreaterThan(0.12)
    expect(heavy).toBeGreaterThan(light * 1.2)
  })
  test('hung from a rod, swings about the ball at its top, canopy and all, and settles under it', () => {
    const canopy = {
      peak: 0,
    }
    // From so far under the ball, the pot swings it out farther, so it takes longer to settle.
    const swing = simulate(5, false, chandelierPhysics, {
      canopy,
      rod: 3.7,
      settle: 100,
    })
    expect(swing).toBeGreaterThan(0.05)
    // The canopy swings along, nearly as far as the hub, which hangs farther from the ball.
    expect(canopy.peak).toBeGreaterThan(swing * 0.5)
    expect(canopy.peak).toBeLessThan(swing)
  })
  test('a miss does not trigger a canned swing', () => {
    expect(simulate(5, true)).toBeLessThan(0.001)
  })
})
