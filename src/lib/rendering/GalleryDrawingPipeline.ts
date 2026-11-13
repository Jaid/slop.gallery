import type {RenderItem} from './refractingPanes.ts'
import type {Camera} from 'three/webgpu'

import {StandardDrawingPipeline} from 'three/webgpu'

import {PaneOrder} from './refractingPanes.ts'

/** how a drawing pipeline projects one object of a scene into a render list, recursing into its children through `project` */
export type Projection = (...input: Parameters<StandardDrawingPipeline['project']>) => void

/**
 * Projects scenes through a projection that can change from one render to the next, three’s own by default.
 *
 * three’s projection walks into children through `project`, so a projection sees every object of the scene and can leave some out, draw them regardless of the frustum or hand them on to {@link standard}.
 * Once projected, the transparent draws are ranked around the refracting panes in view, for the renderer to sort them with {@link paneOrder}.
 */
export default class GalleryDrawingPipeline extends StandardDrawingPipeline {
  /** the order of transparent draws around refracting panes, whose `compare` the renderer sorts transparent draws with */
  readonly paneOrder = new PaneOrder

  /** three’s own projection of an object and, through {@link project}, its children */
  readonly standard: Projection = (...input) => {
    super.project(...input)
  }

  /** the projection {@link project} applies, {@link standard} unless replaced */
  projection: Projection = this.standard

  override begin(camera: Camera, renderContext: unknown) {
    super.begin(camera, renderContext)
    this.paneOrder.begin(camera)
  }

  override finishRenderList(renderList: unknown) {
    super.finishRenderList(renderList)
    this.paneOrder.rank((renderList as {transparent: ReadonlyArray<RenderItem>}).transparent)
  }

  override project(...input: Parameters<StandardDrawingPipeline['project']>) {
    this.projection(...input)
  }
}
