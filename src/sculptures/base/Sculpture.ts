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

/** Lightweight catalog entry. Only the selected sculpture needs to load its model and geometry. */
export default abstract class Sculpture {
  abstract readonly description: string
  abstract readonly id: string
  /** Physical mass in kilograms, excluding the socket. */
  abstract readonly mass: number
  /** width, height and depth in meters, used to fit the sculpture to its socket and frame it for inspection */
  abstract readonly size: Vec3
  abstract readonly title: string

  abstract loadModel(): Promise<SculptureModel>
}
