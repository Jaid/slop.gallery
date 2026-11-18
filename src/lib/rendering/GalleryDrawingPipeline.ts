import {StandardDrawingPipeline} from 'three/webgpu'

/** how a drawing pipeline projects one object of a scene into a render list, recursing into its children through `project` */
export type Projection = (...input: ProjectArgs) => void
type ProjectArgs = Parameters<StandardDrawingPipeline['project']>

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

  private readonly pending = new WeakMap<object, Array<{
    distance: number
    draw: Projection
    input: ProjectArgs
    priority: boolean
  }>>

  /** A bundle records its draws once. Its contents must not be streamed one object at a time. */
  get recordingBundle() {
    return this._bundleDepth > 0
  }

  override beginRenderList(list: object) {
    // Discard an unfinished projection if a render threw before the list was finished.
    this.pending.delete(list)
    super.beginRenderList(list)
  }

  override finishRenderList(list: object) {
    const pending = this.pending.get(list)
    if (pending) {
      this.pending.delete(list)
      const outer = this.projection
      // The children have already been projected. Only the deferred objects themselves go into this list now, before three sorts it for drawing.
      this.projection = () => {}
      try {
        pending.sort((a, b) => Number(b.priority) - Number(a.priority) || a.distance - b.distance)
        for (const {draw, input} of pending) {
          draw(...input)
        }
      } finally {
        this.projection = outer
      }
    }
    super.finishRenderList(list)
  }

  override project(...input: ProjectArgs) {
    this.projection(...input)
  }

  /** Defer a cold drawable’s own projection, not its subtree. Descendants compete for the budget independently, with their original group order and clipping context. */
  rank(distance: number, priority: boolean, draw: Projection, ...input: ProjectArgs) {
    const [object, camera, groupOrder, renderList, clippingContext] = input
    const pending = this.pending.getOrInsertComputed(renderList as object, () => [])
    pending.push({
      distance,
      draw,
      input,
      priority,
    })
    for (const child of object.children) {
      this.project(child, camera, groupOrder, renderList, clippingContext)
    }
  }
}
