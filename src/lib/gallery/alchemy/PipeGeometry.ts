import type {Vec3} from '../types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {CylinderGeometry, Quaternion, TorusGeometry, Vector3} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {rod} from '../lodgeInterior/place.ts'
import PolylineTubeGeometry from '../railings/PolylineTubeGeometry.ts'
import {alchemyPipe, southWallFace} from './alchemyMachine.ts'

/** how far round a bend may turn between two of the points along it, in radians */
const bendStep = Math.PI / 24
/** how far each flange round a joint of the pipe stands out of it, and how long it is along it */
const flange = [0.022, 0.035] as const
const up = new Vector3(0, 1, 0)

/**
 * The points along the middle of a pipe through the corners, its bends rounded off by arcs of radius `bend`, every one turning by at most {@link bendStep} between two points, and where each bend starts and ends.
 */
export function pipeCenterline(corners: ReadonlyArray<Vec3>, bend: number) {
  const points: Array<Vector3> = [new Vector3(...corners[0])]
  const joints: Array<{
    direction: Vector3
    point: Vector3
  }> = []
  for (let index = 1; index < corners.length - 1; index++) {
    const corner = new Vector3(...corners[index])
    const incoming = corner.clone().sub(new Vector3(...corners[index - 1])).normalize()
    const outgoing = new Vector3(...corners[index + 1])
    outgoing.sub(corner).normalize()
    const turn = incoming.angleTo(outgoing)
    if (turn < 1e-6) {
      continue
    }
    const reach = bend * Math.tan(turn / 2)
    const start = corner.clone().addScaledVector(incoming, -reach)
    // From the bend’s start toward its middle, square to where the pipe runs in
    const inward = outgoing.clone().addScaledVector(incoming, -incoming.dot(outgoing)).normalize()
    const center = start.clone().addScaledVector(inward, bend)
    const steps = Math.ceil(turn / bendStep)
    for (let step = 0; step <= steps; step++) {
      const angle = turn * step / steps
      points.push(center.clone().addScaledVector(inward, -bend * Math.cos(angle)).addScaledVector(incoming, bend * Math.sin(angle)))
    }
    joints.push({
      point: start,
      direction: incoming,
    }, {
      point: corner.clone().addScaledVector(outgoing, reach),
      direction: outgoing,
    })
  }
  points.push(new Vector3(...corners.at(-1)!))
  return {
    points,
    joints,
  }
}

/** A flange round a pipe of radius `radius` at the point, square to the direction. */
export function flangeAt(point: Vector3, direction: Vector3, radius: number) {
  const ring = new CylinderGeometry(radius + flange[0], radius + flange[0], flange[1], 40, 1, true)
  const bead = new TorusGeometry(radius + flange[0], 0.006, 6, 40)
  bead.rotateX(Math.PI / 2)
  const turn = new Quaternion
  turn.setFromUnitVectors(up, direction)
  return [ring, bead.clone().translate(0, flange[1] / 2, 0), bead.translate(0, -flange[1] / 2, 0)].map(part => part.applyQuaternion(turn).translate(point.x, point.y, point.z))
}

/**
 * The alchemy machine’s pipe, see {@link alchemyPipe}, in the world’s frame: hammered brass along its rounded corners with a flange at either end of every bend and a coupling before the cannon. Two iron brackets hold the riser to the south wall.
 */
export default class PipeGeometry {
  readonly brackets: BufferGeometry
  readonly pipe: BufferGeometry

  constructor() {
    const {bend, corners, radius} = alchemyPipe
    const {points, joints} = pipeCenterline(corners, bend)
    const tube = new PolylineTubeGeometry(points, radius, 32)
    // and a coupling just short of the cannon’s breech, which its end runs into
    const end = points.at(-1)!.clone().sub(points.at(-2)!).normalize()
    const coupling = {
      point: points.at(-1)!.clone().addScaledVector(end, -0.07),
      direction: end,
    }
    this.pipe = mergeParts([tube, ...[...joints, coupling].flatMap(({direction, point}) => flangeAt(point, direction, radius))])
    const face = southWallFace
    const clamps: Array<BufferGeometry> = []
    const [, riserBottom, riserTop] = corners.map(corner => new Vector3(...corner))
    const boltRadius = 0.012
    const clampRadius = radius + boltRadius
    for (const fraction of [0.3, 0.75]) {
      const point = riserBottom.clone().lerp(riserTop, fraction)
      // A U-bolt wraps the room-facing half of the pipe; each leg seats in a plate against the plaster.
      const clamp = new TorusGeometry(clampRadius, boltRadius, 8, 20, Math.PI)
      clamp.rotateX(-Math.PI / 2)
      clamps.push(clamp.translate(point.x, point.y, point.z))
      for (const side of [-1, 1]) {
        const from = new Vector3(point.x + side * clampRadius, point.y, point.z)
        clamps.push(rod(from, new Vector3(from.x, from.y, face - 0.006), boltRadius, 8))
        const plate = new CylinderGeometry(0.035, 0.035, 0.012, 20)
        clamps.push(plate.rotateX(Math.PI / 2).translate(from.x, from.y, face - 0.006))
      }
    }
    this.brackets = mergeParts(clamps)
  }

  dispose() {
    this.brackets.dispose()
    this.pipe.dispose()
  }
}
