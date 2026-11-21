import type {BufferGeometry} from 'three/webgpu'

import {CircleGeometry, CylinderGeometry, Quaternion, RingGeometry, TorusGeometry, Vector3} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {flangeAt, pipeCenterline} from '../alchemy/PipeGeometry.ts'
import {wallFace} from '../architectureDimensions.ts'
import {rod} from '../lodgeInterior/place.ts'
import PolylineTubeGeometry from '../railings/PolylineTubeGeometry.ts'
import {cistern, cisternDomeHeight, cisternInflow} from './cistern.ts'

/** the radius of the inflow’s pipe and of its bore, and the radius of its bend where it turns down into the spout */
const [radius, bore, bend] = [0.06, 0.045, 0.16] as const
/** how far behind the half dome’s inside the pipe starts, hidden in its shell */
const buried = 0.12
/** how deep the spout’s bore shows inside its mouth */
const mouthDepth = 0.05
/** how far along the pipe’s run from the half dome its hanger holds it */
const hangerAt = 0.6
const up = new Vector3(0, 1, 0)
/** A part built along y, turned to run along the direction. */
const along = <T extends BufferGeometry>(geometry: T, direction: Vector3) => {
  const turn = new Quaternion
  return geometry.applyQuaternion(turn.setFromUnitVectors(up, direction.clone().normalize()))
}
/** Turns the part inside out, to face the other way. */
function inward<T extends BufferGeometry>(geometry: T) {
  const index = geometry.index!
  for (let i = 0; i < index.count; i += 3) {
    const second = index.getX(i + 1)
    index.setX(i + 1, index.getX(i + 2))
    index.setX(i + 2, second)
  }
  const normals = geometry.getAttribute('normal')
  for (let i = 0; i < normals.count; i++) {
    normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i))
  }
  return geometry
}
/** The pipe’s middle line, from inside the half dome’s shell round its bend down to the spout’s mouth. */
function centerline() {
  const {leaves, mouth, turns} = cisternInflow
  const start = new Vector3(...leaves)
  const run = new Vector3(...turns)
  run.sub(start).normalize()
  return pipeCenterline([start.addScaledVector(run, -buried).toArray(), turns, mouth], bend)
}
/** The half dome’s inside straight over the point in plan, and its normal there, facing into the cistern. */
function domeOver(x: number, z: number) {
  const [cx, cz] = cistern.center
  const inside = cistern.radius - wallFace
  const y = cisternDomeHeight(x, z)
  const normal = new Vector3(cx - x, -(y - cistern.spring) * inside ** 2 / cistern.rise ** 2, cz - z)
  return {
    point: new Vector3(x, y, z),
    normal: normal.normalize(),
  }
}

/**
 * The cistern’s inflow, see {@link cisternInflow}, in the world’s frame: a lead pipe out of the foot of the half dome, with a collar where it leaves it, flanges at both ends of its bend down into the spout and a dark bore up its mouth, hung from the dome by a rod and a clamp halfway along its run.
 * Only the pipe itself collides, in `collision`.
 */
export default class InflowGeometry {
  readonly collision: BufferGeometry
  readonly pipe: BufferGeometry

  constructor() {
    const {joints, points} = centerline()
    this.collision = new PolylineTubeGeometry(points, radius, 12)
    const mouth = new Vector3(...cisternInflow.mouth)
    const leaves = new Vector3(...cisternInflow.leaves)
    const normal = new Vector3(...cisternInflow.normal)
    const run = new Vector3(...cisternInflow.turns)
    run.sub(leaves)
    // The collar lies on the dome’s inside round the pipe, square to the dome.
    const collar = along(new CylinderGeometry(radius + 0.045, radius + 0.055, 0.03, 28), normal)
    const seat = leaves.clone().addScaledVector(normal, 0.005)
    collar.translate(seat.x, seat.y, seat.z)
    // the spout’s bore, open down at its mouth: its stone-dark inside facing in, the iron round it and the pipe’s end deep in it
    const sleeve = inward(new CylinderGeometry(bore, bore, mouthDepth, 20, 1, true))
    sleeve.translate(mouth.x, mouth.y + mouthDepth / 2, mouth.z)
    const lip = new RingGeometry(bore, radius, 24)
    lip.rotateX(Math.PI / 2).translate(mouth.x, mouth.y, mouth.z)
    const end = new CircleGeometry(bore, 20)
    end.rotateX(Math.PI / 2).translate(mouth.x, mouth.y + mouthDepth, mouth.z)
    // the hanger: a clamp round the pipe, and a rod from it straight up to a plate on the dome
    const held = leaves.clone().addScaledVector(run, hangerAt)
    const ring = new TorusGeometry(radius + 0.012, 0.012, 8, 28)
    const clamp = along(ring.rotateX(Math.PI / 2), run)
    clamp.translate(held.x, held.y, held.z)
    const dome = domeOver(held.x, held.z)
    const plate = along(new CylinderGeometry(0.05, 0.05, 0.016, 20), dome.normal)
    const hung = dome.point.clone().addScaledVector(dome.normal, 0.008)
    plate.translate(hung.x, hung.y, hung.z)
    const hanger = rod(new Vector3(held.x, held.y + radius + 0.012, held.z), dome.point, 0.012, 8)
    this.pipe = mergeParts([
      new PolylineTubeGeometry(points, radius, 24),
      ...joints.flatMap(({direction, point}) => flangeAt(point, direction, radius)),
      collar,
      sleeve,
      lip,
      end,
      clamp,
      plate,
      hanger,
    ])
  }

  dispose() {
    this.collision.dispose()
    this.pipe.dispose()
  }
}
