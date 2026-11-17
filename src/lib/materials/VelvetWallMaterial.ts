import type {Wall} from '../placement/wallGeometry.ts'
import type {VelvetOptions} from './VelvetMaterial.ts'
import type {Object3D} from 'three/webgpu'

import {atan, fract, normalWorldGeometry, positionWorld, select, uniform, vec2} from 'three/tsl'
import {Vector4} from 'three/webgpu'

import VelvetMaterial from './VelvetMaterial.ts'

/** what a mesh not covering a round wall gets for its ring: none, a radius of 0 */
const noRing = new Vector4
const rings = new WeakMap<Wall, Vector4>
/**
 * The ring of the round wall the mesh covers, which `WallSurface` hands its surface as `userData.wall`: its middle in world x and z, its radius and the angle round it, from world x toward world z, where the pattern starts over.
 * That angle lies in the middle of the wall’s first opening, where there is no wall to show the jump, or where the wall’s ends meet if it has none.
 */
function ringOf(object: Object3D | null) {
  const wall = object?.userData.wall as Wall | undefined
  if (!wall?.curveRadius) {
    return noRing
  }
  let ring = rings.get(wall)
  if (!ring) {
    const radius = wall.curveRadius
    const [x, , z] = wall.center
    // The wall faces its ring’s middle along its own z, and runs round it toward greater angles along its own x.
    const middleX = x + Math.sin(wall.rotation) * radius
    const middleZ = z + Math.cos(wall.rotation) * radius
    const start = wall.holes?.[0]?.u ?? Math.PI * radius
    ring = new Vector4(middleX, middleZ, radius, Math.atan2(z - middleZ, x - middleX) + start / radius)
    rings.set(wall, ring)
  }
  return ring
}
/** Projects the velvet along a wall, following its arc if curved, and up. */
export default class VelvetWallMaterial extends VelvetMaterial {
  constructor(options: VelvetOptions = {}) {
    const normal = normalWorldGeometry
    // Along the wall, whichever axis it runs on, or round a round wall’s arc, and up.
    const ring = uniform(new Vector4).onObjectUpdate(({object}) => ringOf(object))
    const fromMiddle = vec2(positionWorld.x.sub(ring.x), positionWorld.z.sub(ring.y)).toVar('velvetFromMiddle')
    const turn = atan(fromMiddle.y, fromMiddle.x).sub(ring.w).div(Math.PI * 2)
    const arc = fract(turn).mul(ring.z.mul(Math.PI * 2))
    // The arc stands still through the reveal of an opening in a round wall, whose faces run straight out of the ring: it is laid out like a flat wall’s, as the lining beyond it is.
    const roundFace = ring.z.greaterThan(0).and(fromMiddle.normalize().dot(normal.xz).abs().greaterThan(0.5))
    const u = select(roundFace, arc, select(normal.x.abs().greaterThan(normal.z.abs()), positionWorld.z, positionWorld.x))
    super(vec2(u, positionWorld.y), options)
  }
}
