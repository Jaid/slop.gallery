import type {GalleryRoomId} from '../../../../worlds/gallery/index.ts'
import type {Vec3} from '../../types.ts'
import type {BufferGeometry, Material} from 'three/webgpu'

/** in how many directions a curio’s hull reaches out to the furthest corner of its meshes */
const hullDirections = 128

/** a mesh of a curio: its geometry in the curio’s own frame and its material */
export type CurioPart = {
  geometry: BufferGeometry
  material: Material
  name: string
}

/** What a curio is made of: its meshes, which own their geometries and materials, released together. */
export class CurioModel {
  constructor(readonly parts: ReadonlyArray<CurioPart>) {}

  /**
   * The corners of its convex hull, as flat coordinates: of all the corners of its meshes, the one reaching furthest out in each of {@link hullDirections} directions spread evenly round, each once.
   * A few dozen corners wrap it within a few millimeters, flat faces staying flat; the thousands of a hull round every corner, many of them all but coplanar, keep a resting body jittering and creeping across the floor forever, never falling asleep.
   */
  get hull() {
    const corners = this.parts.flatMap(({geometry}) => [...geometry.getAttribute('position').array])
    const chosen = new Set<number>
    for (let index = 0; index < hullDirections; index++) {
      // Fibonacci sphere: every direction claims as much of the sphere round it
      const y = 1 - 2 * (index + 0.5) / hullDirections
      const across = Math.sqrt(1 - y * y)
      const angle = index * Math.PI * (3 - Math.sqrt(5))
      const [dx, dz] = [Math.cos(angle) * across, Math.sin(angle) * across]
      let furthest = -Infinity
      let at = 0
      for (let corner = 0; corner < corners.length; corner += 3) {
        const reach = corners[corner] * dx + corners[corner + 1] * y + corners[corner + 2] * dz
        if (!(reach > furthest)) {
          continue
        }
        furthest = reach
        at = corner
      }
      chosen.add(at)
    }
    return Float32Array.from([...chosen].flatMap(corner => corners.slice(corner, corner + 3)))
  }

  dispose() {
    for (const {geometry, material} of this.parts) {
      geometry.dispose()
      material.dispose()
    }
  }
}

/**
 * A thing lying about the gallery that the player can pick up, carry, drop and throw, like a prop of a kind of its own: built of procedural meshes, with a convex hull around all of them as its collider.
 * Its prop is `prop-<id>`, and it lives in a folder of its own.
 */
export default abstract class Curio {
  abstract readonly id: string
  /** how heavy it is, in kilograms */
  abstract readonly mass: number
  /** where its origin lies when a game begins, in world space */
  abstract readonly position: Vec3
  /** how far from its origin the camera orbits it while V is held */
  abstract readonly reach: number
  /** the room it lies in when a game begins */
  abstract readonly room: GalleryRoomId
  /** how it is turned when a game begins, as Euler angles */
  readonly rotation: Vec3 = [0, 0, 0]
  abstract readonly title: string
  /** Whether it is attached to the scenery at the start, before its first pickup. */
  readonly type: 'dynamic' | 'fixed' = 'dynamic'

  get propId() {
    return `prop-${this.id}`
  }

  /** Builds its meshes, in its own frame. */
  abstract createModel(): CurioModel
}
