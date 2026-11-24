import type {Vec3} from 'math'
import type {ComponentType} from 'react'
import type {Material} from 'three/webgpu'

export type SculptureModelProps = {
  /** Total mass in kilograms, distributed across the model’s colliders. */
  mass: number
  /** The socket’s own material. Use it for every visible mesh; the socket owns its lifetime. */
  material: Material
}

/** Draws a sculpture and its collider in meters around the center of its foot, at local y = 0. The socket is not part of the model. */
export type SculptureModel = ComponentType<SculptureModelProps>

/** who made a sculpture, like a Knot’s author: the model that wrote it */
export type SculptureAuthor = {
  model: {
    effortLevel?: string
    slug?: string
    title: string
  }
}

/** a sculpture’s authorship, kept in the `metadata.ts` of its folder */
export type SculptureMetadata = {
  author: SculptureAuthor
  /** Unix timestamp in seconds when the sculpture was created. */
  createdAt: number
  harness?: string
}

/** Lightweight catalog entry. Only the selected sculpture needs to load its model and geometry. */
export default abstract class Sculpture {
  abstract readonly description: string
  abstract readonly id: string
  /** Physical mass in kilograms, excluding the socket. */
  abstract readonly mass: number
  abstract readonly metadata: SculptureMetadata
  /** width, height and depth in meters, used to fit the sculpture to its socket and frame it for inspection */
  abstract readonly size: Vec3
  abstract readonly title: string

  /** the year the sculpture was created in */
  get year() {
    const created = new Date(this.metadata.createdAt * 1000)
    return created.getFullYear()
  }

  abstract loadModel(): Promise<SculptureModel>
}
