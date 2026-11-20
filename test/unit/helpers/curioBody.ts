import type {CurioCollider} from '../../../src/lib/gallery/curios/base/Curio.ts'
import type {Curio} from '../../../src/lib/gallery/curios/index.ts'
import type RAPIER from '@dimforge/rapier3d-compat'

import {Euler, Quaternion} from 'three/webgpu'

/** Gives the body the colliders of the curio’s body and its damping as `Curio` builds them, gripping and bouncing like every prop’s. */
export function addCurioColliders(rapier: typeof RAPIER, world: RAPIER.World, body: RAPIER.RigidBody, curio: Curio) {
  const make = makers(rapier)
  body.setAngularDamping(curio.angularDamping)
  for (const collider of curio.colliders) {
    const [x, y, z] = collider.position
    const turn = new Quaternion
    turn.setFromEuler(new Euler(...collider.rotation))
    world.createCollider(make[collider.shape](...collider.args).setTranslation(x, y, z).setRotation(turn).setMass(collider.mass).setFriction(0.8).setRestitution(0.32), body)
  }
}

/** Rapier’s makers of the shapes a curio’s body is made of, by their names, each taking the arguments its collider gives */
function makers({ColliderDesc}: typeof RAPIER): Record<CurioCollider['shape'], (...args: ReadonlyArray<number>) => RAPIER.ColliderDesc> {
  return {
    ball: radius => ColliderDesc.ball(radius),
    capsule: (halfHeight, radius) => ColliderDesc.capsule(halfHeight, radius),
    cuboid: (x, y, z) => ColliderDesc.cuboid(x, y, z),
    cylinder: (halfHeight, radius) => ColliderDesc.cylinder(halfHeight, radius),
    roundCuboid: (x, y, z, border) => ColliderDesc.roundCuboid(x, y, z, border),
    roundCylinder: (halfHeight, radius, border) => ColliderDesc.roundCylinder(halfHeight, radius, border),
  }
}
