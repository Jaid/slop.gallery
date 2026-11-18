import type {RigidBody, World} from '@dimforge/rapier3d-compat'

import {machineBody, workbench} from './alchemyMachine.ts'

const [width, lidY, depth] = machineBody.size
const halfHeight = (workbench.height - workbench.top - lidY) / 2
const center = {
  x: machineBody.center[0],
  y: lidY + halfHeight,
  z: machineBody.center[1],
}
const half = {
  x: width / 2,
  y: halfHeight,
  z: depth / 2,
}

/** A single upward kick to loose bodies in the space above the lid. From rest, 1 m/s lifts the bowler about 5 cm. */
export default function puffFromLid(world: World) {
  const bodies = new Set<RigidBody>
  world.collidersWithAabbIntersectingAabb(center, half, collider => {
    const body = collider.parent()
    if (body?.isDynamic() && body.isEnabled()) {
      bodies.add(body)
    }
    return true
  })
  for (const body of bodies) {
    const {x, y, z} = body.worldCom()
    if (Math.abs(x - center.x) <= half.x && Math.abs(y - center.y) <= half.y && Math.abs(z - center.z) <= half.z) {
      body.applyImpulse({
        x: 0,
        y: body.mass(),
        z: 0,
      }, true)
    }
  }
}
