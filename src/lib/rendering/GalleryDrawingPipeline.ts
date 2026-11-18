import type {BufferGeometry, Camera, GeometryGroup, Material, Object3D} from 'three/webgpu'

import {StandardDrawingPipeline} from 'three/webgpu'

/** how a drawing pipeline projects one object of a scene into a render list, recursing into its children through `project` */
export type Projection = (...input: Parameters<StandardDrawingPipeline['project']>) => void

type Draw = Parameters<StandardDrawingPipeline['pushRenderItem']>
type Queue = {
  camera: Camera
  draws: Map<Object3D, Array<Draw>>
  needsAdmission: (object: Object3D) => boolean
  renderList: unknown
}

/**
 * Projects scenes through a projection that can change from one render to the next, three’s own by default.
 *
 * three’s projection walks into children through `project`, so a projection sees every object of the scene and can leave some out, draw them regardless of the frustum or hand them on to {@link standard}.
 */
export default class GalleryDrawingPipeline extends StandardDrawingPipeline {
  /** three’s own projection of an object and, through {@link project}, its children */
  readonly standard: Projection = (...input) => {
    super.project(...input)
  }

  /** the projection {@link project} applies, {@link standard} unless replaced */
  projection: Projection = this.standard

  private queue?: Queue

  override isCulled(object: Object3D, camera: Camera) {
    // A queued object gets its first draw even outside the frustum, so its resources are ready before it comes into view.
    return !(this.queue?.camera === camera && this._bundleDepth === 0 && this.queue.needsAdmission(object)) && super.isCulled(object, camera)
  }

  override project(...input: Parameters<StandardDrawingPipeline['project']>) {
    this.projection(...input)
  }

  /** Collect first-time draws during normal projection, then submit just those admitted by the loading scheduler. */
  projectQueued(input: Parameters<Projection>, needsAdmission: Queue['needsAdmission'], admit: (objects: Iterable<Object3D>) => Iterable<Object3D>) {
    const outer = this.queue
    const queue: Queue = {
      camera: input[1],
      draws: new Map,
      needsAdmission,
      renderList: input[3],
    }
    this.queue = queue
    try {
      this.standard(...input)
      for (const object of admit(queue.draws.keys())) {
        for (const draw of queue.draws.get(object)!) {
          super.pushRenderItem(...draw)
        }
      }
    } finally {
      this.queue = outer
    }
  }

  override pushRenderItem(renderList: unknown, object: Object3D, geometry: BufferGeometry, material: Material, groupOrder: number, z: number, group: GeometryGroup | null, clipping: Draw[7]) {
    const queue = this.queue
    // Bundles record a complete render list at once, not piecemeal over multiple frames.
    if (queue && queue.renderList === renderList && queue.needsAdmission(object)) {
      const draw: Draw = [renderList, object, geometry, material, groupOrder, z, group, clipping]
      const draws = queue.draws.get(object)
      if (draws) {
        draws.push(draw)
      } else {
        queue.draws.set(object, [draw])
      }
    } else {
      super.pushRenderItem(renderList, object, geometry, material, groupOrder, z, group, clipping)
    }
  }
}
