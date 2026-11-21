import type {FunnelPoint} from '../FunnelGeometry.ts'
import type {Vec3} from '../types.ts'

import {BufferGeometry} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import FunnelGeometry from '../FunnelGeometry.ts'
import PolylineTubeGeometry from '../railings/PolylineTubeGeometry.ts'
import {alchemyIntake, alchemySink, workbench} from './alchemyMachine.ts'
import {flangeAt, pipeCenterline} from './PipeGeometry.ts'

/** how many straight pieces the bowl’s curve is cut into */
const curveSteps = 16
/** how far the flange round the sink’s rim lies out over the bench’s top */
const flange = 0.028
/** how far the flange stands over the bench’s top */
const lift = 0.0015

/**
 * The bowl and its bent intake, in the sink rim’s frame. Their inner surfaces form one continuous collider down to the chest’s side.
 */
export default class SinkGeometry {
  readonly collision: BufferGeometry
  readonly metal: BufferGeometry

  constructor() {
    const {curve, radius, sweep, throat, thickness} = alchemySink
    const under = -workbench.top
    // the last one where the bowl meets the throat
    const bowl = Array.from({length: curveSteps}, (_, index): FunnelPoint => {
      const angle = sweep * (index + 1) / curveSteps
      return [radius - curve * (1 - Math.cos(angle)), under - curve * Math.sin(angle)]
    })
    const corners = alchemyIntake.corners.map(p => p.map((v, i) => v - alchemySink.center[i]) as Vec3)
    const funnel = new FunnelGeometry([[radius, lift], [radius, under], ...bowl, [throat, corners[0][1]]], thickness, flange)
    const {points, joints} = pipeCenterline(corners, alchemyIntake.bend)
    const bore = new PolylineTubeGeometry(points, throat, 64)
    // Face the bore inward for rendering and for contacts with an orb inside it.
    bore.index!.array.reverse()
    const normals = bore.getAttribute('normal')
    for (let i = 0; i < normals.count; i++) {
      normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i))
    }
    const boreCollision = new BufferGeometry
    this.collision = mergeParts([funnel.collision, boreCollision.copy(bore)])
    const outerRadius = throat + thickness
    this.metal = mergeParts([funnel.metal, bore, new PolylineTubeGeometry(points, outerRadius, 64), ...joints.flatMap(({point, direction}) => flangeAt(point, direction, outerRadius))])
  }

  dispose() {
    this.collision.dispose()
    this.metal.dispose()
  }
}
