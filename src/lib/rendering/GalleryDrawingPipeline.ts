import type {BufferGeometry, Camera, Object3D} from 'three/webgpu'

import {Matrix3, StandardDrawingPipeline, Vector3} from 'three/webgpu'

/** how a drawing pipeline projects one object of a scene into a render list, recursing into its children through `project` */
export type Projection = (...input: Parameters<StandardDrawingPipeline['project']>) => void

type TransparentRenderItem = {
  geometry: BufferGeometry
  object: Object3D
  renderOrder: number
}
type TransparentRenderList = {
  transparent: Array<TransparentRenderItem>
}
type ActiveGlassPlane = {
  camSign: number
  normal: Vector3
  object: Object3D
  point: Vector3
}

/**
 * Projects scenes through a projection that can change from one render to the next, three’s own by default.
 *
 * three’s projection walks into children through `project`, so a projection sees every object of the scene and can leave some out, draw them regardless of the frustum or hand them on to {@link standard}.
 *
 * Before sorting transparent items, it also orders objects relative to any flat architectural glass panes in view (`userData.glassPlane`),
 * so wide windows never sort behind orbs or knots seen obliquely near their edges.
 */
export default class GalleryDrawingPipeline extends StandardDrawingPipeline {
  /** three’s own projection of an object and, through {@link project}, its children */
  readonly standard: Projection = (...input) => {
    super.project(...input)
  }

  /** the projection {@link project} applies, {@link standard} unless replaced */
  projection: Projection = this.standard
  private readonly cameraPosition = new Vector3
  private readonly delta = new Vector3
  private readonly normalMatrix = new Matrix3
  private readonly worldPoint = new Vector3

  override begin(camera: Camera, renderContext: unknown) {
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    super.begin(camera, renderContext)
  }

  override finishRenderList(renderList: unknown) {
    const list = renderList as Partial<TransparentRenderList> | null
    const transparent = list?.transparent
    if (transparent && transparent.length > 1) {
      this.orderAroundGlassPlanes(transparent)
    }
    super.finishRenderList(renderList)
  }

  override project(...input: Parameters<StandardDrawingPipeline['project']>) {
    this.projection(...input)
  }

  private itemWorldCenter(item: TransparentRenderItem, target: Vector3) {
    if (item.geometry.boundingSphere) {
      return target.copy(item.geometry.boundingSphere.center).applyMatrix4(item.object.matrixWorld)
    }
    return target.setFromMatrixPosition(item.object.matrixWorld)
  }

  private orderAroundGlassPlanes(transparent: Array<TransparentRenderItem>) {
    const planes: Array<ActiveGlassPlane> = []
    for (const item of transparent) {
      const localNormal = item.object.userData.glassPlane as readonly [number, number, number] | undefined
      if (!localNormal) {
        continue
      }
      const point = this.itemWorldCenter(item, new Vector3)
      const normal = new Vector3(...localNormal)
      normal.applyMatrix3(this.normalMatrix.getNormalMatrix(item.object.matrixWorld)).normalize()
      const camSide = normal.dot(this.delta.subVectors(this.cameraPosition, point))
      if (Math.abs(camSide) <= 1e-6) {
        continue
      }
      planes.push({
        camSign: Math.sign(camSide),
        normal,
        object: item.object,
        point,
      })
    }
    if (planes.length === 0) {
      return
    }
    for (const item of transparent) {
      this.itemWorldCenter(item, this.worldPoint)
      let tier = 0
      for (const plane of planes) {
        if (item.object === plane.object) {
          tier += 0.5
          continue
        }
        const side = plane.normal.dot(this.delta.subVectors(this.worldPoint, plane.point)) * plane.camSign
        if (Math.abs(side) <= 1e-4 && item.object.userData.glassPlane) {
          tier += 0.5
        } else if (side < -1e-4) {
          tier += 1
        }
      }
      item.renderOrder = item.renderOrder * 100 - tier
    }
  }
}
