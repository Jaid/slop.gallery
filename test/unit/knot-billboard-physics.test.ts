import {expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {knotBillboardPhysics} from 'knot-materials/knotBillboardPhysics.ts'
import {knotPreviewHeight, knotPreviewMountY, knotPreviewPanelOffsetY, knotPreviewWidth} from 'knot-materials/KnotPreviewLayout.ts'
import {billboardParts} from 'knot-materials/signs.ts'
import {Euler, Quaternion, Vector3} from 'three/webgpu'

import {orbMass} from '../../src/orbs/index.ts'

await RAPIER.init()
function billboardWorld() {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 120
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.12, 0))
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.12, 20).setFriction(1), floor)
  const stand = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, knotPreviewMountY, 0)
    .setCcdEnabled(true)
    .setLinearDamping(knotBillboardPhysics.stand.linearDamping)
    .setAngularDamping(knotBillboardPhysics.stand.angularDamping)
    .setAdditionalSolverIterations(knotBillboardPhysics.solverIterations))
  const sign = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, knotPreviewMountY + knotPreviewPanelOffsetY, knotBillboardPhysics.sign.standGap)
    .setCcdEnabled(true)
    .setLinearDamping(knotBillboardPhysics.sign.linearDamping)
    .setAngularDamping(knotBillboardPhysics.sign.angularDamping)
    .setAdditionalSolverIterations(knotBillboardPhysics.solverIterations))
  const [panel, ...standParts] = billboardParts(knotPreviewWidth, knotPreviewHeight, knotPreviewPanelOffsetY)
  for (const part of standParts) {
    const rotation = new Quaternion
    rotation.setFromEuler(new Euler(...part.rotation ?? [0, 0, 0]))
    world.createCollider(RAPIER.ColliderDesc.cuboid(part.size[0] / 2, part.size[1] / 2, part.size[2] / 2)
      .setTranslation(...part.position)
      .setRotation(rotation)
      .setMass(knotBillboardPhysics.stand.colliderMass)
      .setFriction(knotBillboardPhysics.stand.friction)
      .setRestitution(knotBillboardPhysics.stand.restitution), stand)
  }
  world.createCollider(RAPIER.ColliderDesc.cuboid(panel.size[0] / 2, panel.size[1] / 2, panel.size[2] / 2)
    .setTranslation(0, 0, panel.position[2])
    .setMass(knotBillboardPhysics.sign.mass)
    .setFriction(knotBillboardPhysics.sign.friction)
    .setRestitution(knotBillboardPhysics.sign.restitution), sign)
  return {
    panel,
    sign,
    stand,
    standParts,
    world,
  }
}
function tilt(body: RAPIER.RigidBody) {
  const rotation = body.rotation()
  const quaternion = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
  const euler = new Euler
  euler.setFromQuaternion(quaternion, 'XYZ')
  return Math.max(Math.abs(euler.x), Math.abs(euler.z))
}
function throwBall(world: RAPIER.World, position: [number, number, number], velocity: [number, number, number]) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(...position)
    .setLinvel(...velocity)
    .setGravityScale(0)
    .setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.ball(0.18).setMass(orbMass), body)
}
test('billboard sign simply rests on the stand and can be knocked flat from behind', () => {
  const {panel, sign, standParts, world} = billboardWorld()
  try {
    for (let index = 0; index < 600; index++) {
      world.step()
    }
    const feet = standParts.filter(part => part.size[2] > 0.5)
    const cross = standParts.filter(part => part.rotation)
    expect(cross).toHaveLength(2)
    const feetTop = knotPreviewMountY + Math.max(...feet.map(part => part.position[1] + part.size[1] / 2))
    expect(sign.translation().y).toBeCloseTo(feetTop + panel.size[1] / 2, 2)
    expect(tilt(sign)).toBeLessThan(0.01)
    throwBall(world, [
      0,
      knotPreviewMountY + knotPreviewPanelOffsetY + knotPreviewHeight * 0.34,
      -2.5,
    ], [0, 0, 10])
    let peakTilt = 0
    for (let index = 0; index < 1200; index++) {
      world.step()
      peakTilt = Math.max(peakTilt, tilt(sign))
    }
    expect(peakTilt).toBeGreaterThan(80 * Math.PI / 180)
  } finally {
    world.free()
  }
})
test('billboard stand is an independent dynamic body that shifts under a normal throw', () => {
  const {stand, world} = billboardWorld()
  try {
    for (let index = 0; index < 600; index++) {
      world.step()
    }
    const origin = stand.translation()
    throwBall(world, [knotPreviewWidth * 0.34, 1.4, -2.5], [0, 0, 10])
    let peakDisplacement = 0
    for (let index = 0; index < 720; index++) {
      world.step()
      const position = stand.translation()
      peakDisplacement = Math.max(peakDisplacement, Math.hypot(position.x - origin.x, position.z - origin.z))
    }
    expect(peakDisplacement).toBeGreaterThan(0.01)
    expect(peakDisplacement).toBeLessThan(0.1)
  } finally {
    world.free()
  }
})
test.each([0, 0.3, 0.6, 0.9, 1.2])('sprinting player at x=%p cannot ram the sign through its stand into a wall', x => {
  const {sign, stand, world} = billboardWorld()
  const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 2, -1.2))
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 4, 0.2), wall)
  world.timestep = 1 / 60
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, 0.04, 1.5))
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
  const motor = new EgoMotor(RAPIER, world, body, collider)
  const camera = new Quaternion
  const standRotation = new Quaternion
  const offset = new Vector3
  try {
    for (let index = 0; index < 240; index++) {
      world.step()
    }
    let deepest = Infinity
    for (let index = 0; index < 600; index++) {
      const ramming = index % 90 < 60
      motor.step(world.timestep, {
        backward: !ramming,
        forward: ramming,
        sprint: true,
      }, camera)
      world.step()
      const {w, x: rotationX, y: rotationY, z: rotationZ} = stand.rotation()
      standRotation.set(rotationX, rotationY, rotationZ, w).invert()
      offset.copy(sign.translation()).sub(stand.translation()).applyQuaternion(standRotation)
      // Only while the panel still spans both legs; sliding off the feet sideways is legitimate.
      if (Math.abs(offset.x) < 0.7) {
        deepest = Math.min(deepest, offset.z)
      }
    }
    expect(deepest).toBeGreaterThan(-0.05)
  } finally {
    motor.dispose()
    world.free()
  }
})
