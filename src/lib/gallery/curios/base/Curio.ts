import type {GalleryRoomId} from '../../../../worlds/gallery/index.ts'
import type {Vec3} from '../../types.ts'
import type {BufferGeometry, Material} from 'three/webgpu'

/**
 * A primitive of a curio’s body, in its own frame: where its middle lies, how it is turned, as Euler angles, and how heavy it is for its size, as a share of how heavy the curio’s other shapes are for theirs, 1 by default; then its kind and size, in meters.
 * A `box` is as big all told as its `size`, its edges rounded off by `border`; a `ball` as big as its `radius`; a `capsule` runs along its own y, `length` between the middles of its round ends; a `cylinder` stands along its own y, as `height` high and as far out as `radius` all told, its rims rounded off by `border`.
 */
export type CurioShape = {
  density?: number
  position: Vec3
  rotation?: Vec3
} & ({
  border?: number
  height: number
  kind: 'cylinder'
  radius: number
} | {
  border?: number
  kind: 'box'
  size: Vec3
} | {
  kind: 'ball'
  radius: number
} | {
  kind: 'capsule'
  length: number
  radius: number
})
/** a collider of a curio’s body as Rapier builds it: the shape, named like `ColliderDesc`’s method that makes it, with its arguments, where its middle lies and how it is turned, as Euler angles, and how heavy it is, in kilograms */
export type CurioCollider = {
  mass: number
  position: Vec3
  rotation: Vec3
} & ({
  args: [halfHeight: number, radius: number, border: number]
  shape: 'roundCylinder'
} | {
  args: [halfHeight: number, radius: number]
  shape: 'capsule' | 'cylinder'
} | {
  args: [halfX: number, halfY: number, halfZ: number, border: number]
  shape: 'roundCuboid'
} | {
  args: [halfX: number, halfY: number, halfZ: number]
  shape: 'cuboid'
} | {
  args: [radius: number]
  shape: 'ball'
})
/** a mesh of a curio: its geometry in the curio’s own frame and its material */
export type CurioPart = {
  geometry: BufferGeometry
  material: Material
  name: string
}

/** How much room the shape takes up, in cubic meters, its rounded edges taken as square. */
function volumeOf(shape: CurioShape) {
  switch (shape.kind) {
    case 'ball': {
      return 4 / 3 * Math.PI * shape.radius ** 3
    }
    case 'box': {
      return shape.size[0] * shape.size[1] * shape.size[2]
    }
    case 'capsule': {
      return Math.PI * shape.radius ** 2 * (shape.length + 4 / 3 * shape.radius)
    }
    case 'cylinder': {
      return Math.PI * shape.radius ** 2 * shape.height
    }
  }
}
/** The shape as Rapier builds it, as heavy as `mass`. */
function colliderOf(shape: CurioShape, mass: number): CurioCollider {
  const placed = {
    mass,
    position: shape.position,
    rotation: shape.rotation ?? [0, 0, 0],
  }
  switch (shape.kind) {
    case 'ball': {
      return {
        ...placed,
        args: [shape.radius],
        shape: 'ball',
      }
    }
    case 'box': {
      const [x, y, z] = shape.size.map(side => side / 2)
      const {border = 0} = shape
      return border > 0 ? {
        ...placed,
        args: [x - border, y - border, z - border, border],
        shape: 'roundCuboid',
      } : {
        ...placed,
        args: [x, y, z],
        shape: 'cuboid',
      }
    }
    case 'capsule': {
      return {
        ...placed,
        args: [shape.length / 2, shape.radius],
        shape: 'capsule',
      }
    }
    case 'cylinder': {
      const {border = 0, height, radius} = shape
      return border > 0 ? {
        ...placed,
        args: [height / 2 - border, radius - border, border],
        shape: 'roundCylinder',
      } : {
        ...placed,
        args: [height / 2, radius],
        shape: 'cylinder',
      }
    }
  }
}

/** What a curio is made of: its meshes, which own their geometries and materials, released together. */
export class CurioModel {
  constructor(readonly parts: ReadonlyArray<CurioPart>) {}

  dispose() {
    for (const {geometry, material} of this.parts) {
      geometry.dispose()
      material.dispose()
    }
  }
}

/**
 * A thing lying about the gallery that the player can pick up, carry, drop and throw, like a prop of a kind of its own: built of procedural meshes, with a body of a few primitives roughly wrapping them, see {@link Curio.shapes}.
 * Its prop is `prop-<id>`, and it lives in a folder of its own.
 */
export default abstract class Curio {
  /** how fast its spin dies down by itself, as Rapier’s angular damping: Rapier knows no rolling resistance, so without it, a round body rolls on, or wobbles round on its rim like a spun coin, long after anything real comes to rest */
  readonly angularDamping: number = 0.5
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
  /**
   * What its body is made of, in its own frame: boxes, balls, capsules and cylinders roughly wrapping its meshes, which Rapier rests reliably wherever they lie.
   * Never a convex hull round its meshes: Rapier 0.21 lets one resting a flat face on a sloping floor of welded triangles, like the Exhibition’s ramp, fall right through it (`MeshSurfaceCollider`, whose `FIX_INTERNAL_EDGES` drops the contact), and a hull of many corners keeps a resting body creeping.
   */
  abstract readonly shapes: ReadonlyArray<CurioShape>
  abstract readonly title: string
  /** Whether it is attached to the scenery at the start, before its first pickup. */
  readonly type: 'dynamic' | 'fixed' = 'dynamic'

  /** Its shapes as Rapier builds them, which share its mass by how much room each takes up and how heavy it is for that. */
  get colliders() {
    const weights = this.shapes.map(shape => volumeOf(shape) * (shape.density ?? 1))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    return this.shapes.map((shape, index) => colliderOf(shape, this.mass * weights[index] / total))
  }

  get propId() {
    return `prop-${this.id}`
  }

  /** Builds its meshes, in its own frame. */
  abstract createModel(): CurioModel
}
