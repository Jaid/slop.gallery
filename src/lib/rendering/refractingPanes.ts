import type {Vec3} from '#src/lib/gallery.ts'
import type {Camera, Object3D, Renderer} from 'three/webgpu'

import {viewportTexture} from 'three/tsl'
import {Matrix3, NodeUpdateType, Plane, Vector3} from 'three/webgpu'

/** what three’s render lists hold for every draw, as its sort functions see it */
export type RenderItem = Parameters<NonNullable<Parameters<Renderer['setTransparentSort']>[0]>>[0]

/** the panes in the scene by their mesh, each with the normal of its faces in the mesh’s own space */
const panes = new WeakMap<Object3D, Vector3>

/**
 * A ref callback that marks its mesh as a flat pane refracting what lies behind it, whose faces point along `normal` in the mesh’s own space, until it unmounts.
 *
 * Transparent things behind a pane, like the orbs’ glass and many Knots, then draw before it, see {@link PaneOrder}, so a pane copying the frame through {@link paneBackdrop} bends them along with the room instead of being drawn over by them.
 */
export function refractingPaneRef(normal: Vec3) {
  const direction = new Vector3(...normal)
  direction.normalize()
  return (object: Object3D | null) => {
    if (!object) {
      return
    }
    panes.set(object, direction)
    return () => {
      panes.delete(object)
    }
  }
}

/** Whether the object is marked as a refracting pane, see {@link refractingPaneRef}. */
export function isRefractingPane(object: Object3D) {
  return panes.has(object)
}

/**
 * A copy of the frame for a pane to refract, taken anew right before each object using it draws, transparent things already drawn included.
 *
 * three’s `viewportOpaqueMipTexture` is copied once per render, before the first material reading it draws, which leaves out every transparent thing drawn later, and `viewportTexture` once per render for all objects sharing the node, so the second of two panes would miss what was drawn between them. The copy has no mipmaps, so the view stays pixel-sharp.
 */
export function paneBackdrop() {
  const backdrop = viewportTexture()
  backdrop.updateBeforeType = NodeUpdateType.OBJECT
  return backdrop
}

const normalMatrix = new Matrix3
const center = new Vector3
const normal = new Vector3
/** Where the render item sits in the world: the center of its geometry’s bounds, from which three sorts it too. */
const itemCenter = (item: RenderItem, target: Vector3) => {
  const {geometry, object} = item
  if (geometry && !geometry.boundingSphere) {
    geometry.computeBoundingSphere()
  }
  const sphere = geometry?.boundingSphere
  if (sphere) {
    target.copy(sphere.center)
  } else {
    target.set(0, 0, 0)
  }
  return target.applyMatrix4(object!.matrixWorld)
}

/**
 * Orders transparent draws around the refracting panes in view, see {@link refractingPaneRef}.
 *
 * three sorts transparent draws by the distance of their centers, which fails for a pane 8 m wide: a Knot behind its far end can be nearer than the pane’s center, and draws over the pane, while the pane’s copy of the frame never shows it.
 * Instead, everything on the far side of a pane’s plane draws before that pane and everything on the camera’s side after it; along any ray crossing the plane, a point beyond it lies farther than any point before it, so this is a correct painter’s order.
 * A draw ranks by the number of panes’ planes between it and the camera and a pane half a rank above that, so a pane seen through another one keeps its own place. Within a rank, three’s order holds.
 */
export class PaneOrder {
  /** three’s order of transparent draws, but with the draws behind a pane before it; see {@link PaneOrder} */
  readonly compare = (a: RenderItem, b: RenderItem) => {
    if (a.groupOrder !== b.groupOrder) {
      return a.groupOrder! - b.groupOrder!
    }
    const rank = (this.ranks.get(b) ?? 0) - (this.ranks.get(a) ?? 0)
    if (rank !== 0) {
      return rank
    }
    if (a.renderOrder !== b.renderOrder) {
      return a.renderOrder! - b.renderOrder!
    }
    if (a.z !== b.z) {
      return b.z! - a.z!
    }
    return a.id! - b.id!
  }
  /** the camera of the current render, in world space */
  private readonly eye = new Vector3
  /** the planes of the panes in the current render list, reused from one render to the next */
  private readonly planes: Array<{
    object: Object3D | null
    plane: Plane
  }> = []

  /** the rank of each transparent draw of the render list sorted next */
  private readonly ranks = new WeakMap<RenderItem, number>

  /** Notes the camera of a render, which happens before it projects the scene into its render list. */
  begin(camera: Camera) {
    this.eye.setFromMatrixPosition(camera.matrixWorld)
  }

  /** Ranks the transparent draws of a render list after projection, before the renderer sorts them with {@link compare}. */
  rank(items: ReadonlyArray<RenderItem>) {
    let count = 0
    for (const item of items) {
      const {object} = item
      const localNormal = object && panes.get(object)
      // A pane with several materials draws once per material.
      if (!localNormal || this.planes.some((entry, index) => index < count && entry.object === object)) {
        continue
      }
      const entry = this.planes[count] ?? {
        object: null,
        plane: new Plane,
      }
      this.planes[count] = entry
      entry.object = object
      normalMatrix.getNormalMatrix(object.matrixWorld)
      entry.plane.setFromNormalAndCoplanarPoint(normal.copy(localNormal).applyMatrix3(normalMatrix).normalize(), itemCenter(item, center))
      count++
    }
    for (let index = count; index < this.planes.length; index++) {
      this.planes[index].object = null
    }
    for (const item of items) {
      if (count === 0) {
        this.ranks.delete(item)
        continue
      }
      itemCenter(item, center)
      let rank = 0
      let isPane = false
      for (let index = 0; index < count; index++) {
        const {object, plane} = this.planes[index]
        if (object === item.object) {
          isPane = true
          continue
        }
        if (plane.distanceToPoint(this.eye) * plane.distanceToPoint(center) < 0) {
          rank++
        }
      }
      this.ranks.set(item, isPane ? rank + 0.5 : rank)
    }
  }
}
