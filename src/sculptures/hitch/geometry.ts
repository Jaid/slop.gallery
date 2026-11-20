import type {QuaternionTuple, Vector3Tuple} from 'three/webgpu'

import {CylinderGeometry, Quaternion, TorusKnotGeometry, Vector3} from 'three/webgpu'

import {hitch, hitchColliderSegments, hitchFootOverlap} from './config.ts'

const up = new Vector3(0, 1, 0)

/** A capsule on one piece of the loop’s centerline, turned from its own Y axis onto the stone. */
export type HitchColliderSegment = {
  halfLength: number
  position: Vector3Tuple
  quaternion: QuaternionTuple
}

/** The two meshes of the Hitch and capsule colliders that trace its continuous loop. */
export class HitchSculptureGeometry {
  readonly foot: CylinderGeometry
  readonly knot: TorusKnotGeometry
  readonly knotColliders: ReadonlyArray<HitchColliderSegment>

  constructor() {
    const {foot, knot: shape} = hitch
    const footGeometry = new CylinderGeometry(foot.topRadius, foot.bottomRadius, foot.height, foot.radialSegments)
    footGeometry.scale(1, 1, foot.scaleZ)
    footGeometry.translate(0, foot.height / 2, 0)
    const knot = new TorusKnotGeometry(shape.radius, shape.tube, shape.tubularSegments, shape.radialSegments, shape.p, shape.q)
    knot.computeBoundingBox()
    const bounds = knot.boundingBox!
    const centerX = (bounds.min.x + bounds.max.x) / 2
    const knotY = foot.height - hitchFootOverlap - bounds.min.y
    knot.translate(-centerX, knotY, 0)
    this.foot = footGeometry
    this.knot = knot
    this.knotColliders = this.createKnotColliders(-centerX, knotY)
  }

  /** The combined visible-mesh triangle count, useful when keeping the collection under its budget. */
  get triangleCount() {
    return (this.foot.index?.count ?? this.foot.attributes.position.count) / 3 + (this.knot.index?.count ?? this.knot.attributes.position.count) / 3
  }

  dispose() {
    this.foot.dispose()
    this.knot.dispose()
  }

  private createKnotColliders(offsetX: number, offsetY: number): ReadonlyArray<HitchColliderSegment> {
    const {p, q, radius} = hitch.knot
    const point = (step: number, target = new Vector3) => {
      const u = step / hitchColliderSegments * p * Math.PI * 2
      const v = q / p * u
      return target.set(
        radius * (2 + Math.cos(v)) * 0.5 * Math.cos(u) + offsetX,
        radius * (2 + Math.cos(v)) * 0.5 * Math.sin(u) + offsetY,
        radius * Math.sin(v) * 0.5,
      )
    }
    const from = new Vector3
    const to = new Vector3
    const direction = new Vector3
    const rotation = new Quaternion
    return Array.from({length: hitchColliderSegments}, (_, step) => {
      point(step, from)
      point(step + 1, to)
      direction.subVectors(to, from)
      const halfLength = direction.length() / 2
      rotation.setFromUnitVectors(up, direction.normalize())
      return {
        halfLength,
        position: from.add(to).multiplyScalar(0.5).toArray(),
        quaternion: rotation.toArray(),
      }
    })
  }
}
