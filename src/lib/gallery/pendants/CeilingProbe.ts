import type {FloorPolygon} from '../floorPolygons.ts'
import type {Vec3} from '../types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Ray, Vector3} from 'three/webgpu'

import {insidePolygon} from '../floorPolygons.ts'

export type CeilingHit = {
  /** unit normal facing down into the room */
  normal: Vec3
  point: Vec3
}
export type PendantMount = {
  /** where the rod meets the ceiling, straight above the light */
  anchor: Vec3
  /** radius of a custom ceiling plate where the standard one would be too wide */
  canopyRadius?: number
  /** vertical rod length from the light source to the anchor */
  drop: number
  /** light source position */
  light: Vec3
  /** ceiling normal at the anchor, facing down */
  normal: Vec3
}
/** A horizontal ceiling plane, e.g. a passage’s flat roof slabs over its elbows. */
export type FlatCeiling = {
  areas: ReadonlyArray<FloorPolygon>
  y: number
}

/** Room for the canopy: every rim sample has to land on the plane under the canopy’s center. */
export const canopyClearance = 0.08
const rimSamples = 12
/** Faceted vault crowns deviate a few millimeters from the canopy plane; the canopy is sunk deeper than this into the ceiling. */
export const planeTolerance = 0.006
const up = new Vector3(0, 1, 0)

/** Finds what a pendant can hang from, by casting straight up against the surrounding ceiling surfaces. */
export default class CeilingProbe {
  private readonly bounds: Array<MeshBVH>

  constructor(surfaces: ReadonlyArray<BufferGeometry>, private readonly flat: ReadonlyArray<FlatCeiling> = []) {
    this.bounds = surfaces.filter(surface => surface.hasAttribute('position') && surface.getAttribute('position').count > 0).map(surface => new MeshBVH(surface, {indirect: true}))
  }

  /** The first ceiling straight above `origin`. */
  hit(origin: Vec3): CeilingHit | undefined {
    const ray = new Ray(new Vector3(...origin), up)
    let best: CeilingHit | undefined
    let bestDistance = Infinity
    for (const bounds of this.bounds) {
      const intersection = bounds.raycastFirst(ray, DoubleSide)
      if (!intersection?.face || intersection.distance >= bestDistance) {
        continue
      }
      const normal = intersection.face.normal.clone()
      if (normal.dot(up) > 0) {
        normal.negate()
      }
      bestDistance = intersection.distance
      best = {
        point: intersection.point.toArray(),
        normal: normal.toArray(),
      }
    }
    for (const {y, areas} of this.flat) {
      const distance = y - origin[1]
      const covered = areas.some(area => insidePolygon(area, origin[0], origin[2]))
      if (!(covered && distance > 0 && distance < bestDistance)) {
        continue
      }
      bestDistance = distance
      best = {
        point: [origin[0], y, origin[2]],
        normal: [0, -1, 0],
      }
    }
    return best
  }

  /**
   * Hangs a light near `light` from a ceiling area wide enough for its canopy, so it never straddles a rib edge or seam.
   * Searches along the horizontal `along` direction in steps of `step`, 5 cm by default, nearest first, keeping the light’s height.
   */
  mount(light: Vec3, along: Vec3, search = 0.6, step = 0.05): PendantMount | undefined {
    const length = Math.hypot(along[0], along[2])
    if (!(length > 0) || Math.abs(along[1]) > 1e-9) {
      throw new RangeError('Pendants slide along a horizontal direction.')
    }
    const steps = Math.round(search / step)
    for (let index = 0; index <= steps * 2; index++) {
      const offset = (index % 2 ? 1 : -1) * Math.ceil(index / 2) * step
      const candidate: Vec3 = [light[0] + along[0] / length * offset, light[1], light[2] + along[2] / length * offset]
      const center = this.hit(candidate)
      if (center && this.flush(candidate, center)) {
        return {
          light: candidate,
          anchor: center.point,
          drop: center.point[1] - candidate[1],
          normal: center.normal,
        }
      }
    }
  }

  private flush(origin: Vec3, center: CeilingHit) {
    const normal = new Vector3(...center.normal)
    const point = new Vector3(...center.point)
    for (let i = 0; i < rimSamples; i++) {
      const angle = i / rimSamples * Math.PI * 2
      const rim = this.hit([origin[0] + Math.cos(angle) * canopyClearance, origin[1], origin[2] + Math.sin(angle) * canopyClearance])
      if (!rim) {
        return false
      }
      const offset = new Vector3(...rim.point)
      if (Math.abs(offset.sub(point).dot(normal)) > planeTolerance) {
        return false
      }
    }
    return true
  }
}
