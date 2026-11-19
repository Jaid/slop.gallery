import type {RigidBody, World} from '@dimforge/rapier3d-compat'

import {Cuboid, QueryFilterFlags} from '@dimforge/rapier3d-compat'

import {machineBody, workbench} from './alchemyMachine.ts'

/** Across the whole bench, from the chest lid up to 70 cm above the slab, including the orb in its holder. */
const lidY = machineBody.size[1]
const halfHeight = (workbench.height + 0.7 - lidY) / 2
const box = new Cuboid(workbench.length / 2, halfHeight, workbench.depth / 2)
/** Upward speed added to loose items, in m/s; from rest they rise about 13 cm. */
const liftSpeed = 1.6

export default function puffFromLid(world: World, table: RigidBody | null) {
  if (!table) {
    return
  }
  const center = table.translation()
  center.y += lidY + halfHeight
  const turn = table.rotation()
  const bodies = new Set<RigidBody>
  world.intersectionsWithShape(center, turn, box, collider => {
    const body = collider.parent()
    if (body?.isEnabled()) {
      bodies.add(body)
    }
    return true
  }, QueryFilterFlags.ONLY_DYNAMIC, undefined, undefined, table)
  for (const body of bodies) {
    if (box.containsPoint(center, turn, body.worldCom())) {
      body.applyImpulse({
        x: 0,
        y: body.mass() * liftSpeed,
        z: 0,
      }, true)
    }
  }
}
