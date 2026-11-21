import type {Vec3} from './types.ts'
import type {WireframeFloodAnchor, WireframeFloodShape} from './wireframeFlood.ts'
import type {Camera, Object3D, Renderer, Scene} from 'three/webgpu'

import {attribute, clamp, cross, dot, length, max, min, mix, modelWorldMatrix, positionWorld, select, uniform, varying, vec4} from 'three/tsl'
import {Color, DoubleSide, FloatType, MeshBasicNodeMaterial, NearestFilter, RenderTarget, Vector3} from 'three/webgpu'

import {collectMeshPattern} from './meshPath.ts'
import {cornerNames, swapTriangleGeometry} from './triangleGeometry.ts'
import {wireframeFloodAnchors} from './wireframeFlood.ts'

// a layer nothing else uses, for marking the highlighted triangles in a pass of their own
const highlightLayer = 31

/** Renders every triangle’s distance to a point into a float target, measured to its nearest point, its centroid or its farthest corner, in 3D for a sphere or horizontally for a circle, with red holding the distance, green marking highlighted triangles and alpha marking covered pixels. Like the wireframe fill, it draws every mesh opaque and keeps each material’s `positionNode`, so the depth order matches the wireframe. The corners come from the undisplaced geometry around each vertex and ignore instance transforms, which only shifts them by as much as a displacement or a particle moves. Meant for headless rendering: each geometry is copied once, and the copies swap in for the pass. */
export default class FloodTriangles {
  /** what point of a triangle its distance is measured to */
  anchor: WireframeFloodAnchor = 'nearest'
  /** sphere measures in 3D, circle only horizontally */
  shape: WireframeFloodShape = 'sphere'
  readonly target = new RenderTarget(1, 1, {
    magFilter: NearestFilter,
    minFilter: NearestFilter,
    type: FloatType,
  })
  private readonly axes = new Vector3(1, 1, 1)
  private readonly clearColor = new Color
  private readonly highlightMaterial: MeshBasicNodeMaterial
  private readonly material: MeshBasicNodeMaterial
  private readonly origin = new Vector3

  constructor() {
    // a circle flattens everything onto the ground plane, where a vertical triangle collapses into a segment
    const axes = uniform(this.axes).onRenderUpdate(() => this.axes.set(1, Number(this.shape === 'sphere'), 1))
    const [a, b, c] = cornerNames.map(name => varying(positionWorld.add(modelWorldMatrix.mul(vec4(attribute<'vec3'>(name, 'vec3'), 0)).xyz)).setInterpolation('flat').mul(axes))
    const point = uniform(this.origin).mul(axes)
    // the nearest point is the point’s projection when it falls inside the triangle, otherwise the nearest point on one of its edges
    const edgeDistance = (from: typeof a, to: typeof a) => {
      const edge = to.sub(from)
      return length(point.sub(from.add(edge.mul(clamp(dot(point.sub(from), edge).div(max(dot(edge, edge), 1e-12)), 0, 1)))))
    }
    const normal = cross(b.sub(a), c.sub(a))
    const inside = min(min(dot(cross(b.sub(a), point.sub(a)), normal), dot(cross(c.sub(b), point.sub(b)), normal)), dot(cross(a.sub(c), point.sub(c)), normal)).greaterThanEqual(0).and(length(normal).greaterThan(1e-9))
    const nearest = select(inside, dot(point.sub(a), normal).abs().div(max(length(normal), 1e-12)), min(min(edgeDistance(a, b), edgeDistance(b, c)), edgeDistance(c, a)))
    const centroid = a.add(b).add(c).div(3).distance(point)
    const farthest = max(max(a.distance(point), b.distance(point)), c.distance(point))
    const anchor = uniform(0).onRenderUpdate(() => wireframeFloodAnchors.indexOf(this.anchor))
    const distance = mix(mix(nearest, centroid, clamp(anchor, 0, 1)), farthest, clamp(anchor.sub(1), 0, 1))
    const options = {
      fog: false,
      forceSinglePass: true,
      side: DoubleSide,
    }
    this.material = new MeshBasicNodeMaterial({
      colorNode: vec4(distance, 0, 0, 1),
      ...options,
    })
    this.material.name = 'WireframeFlood.triangles'
    this.highlightMaterial = new MeshBasicNodeMaterial({
      colorNode: vec4(distance, 1, 0, 1),
      ...options,
    })
    this.highlightMaterial.name = 'WireframeFlood.highlightTriangles'
  }

  dispose() {
    this.target.dispose()
    this.material.dispose()
    this.highlightMaterial.dispose()
  }

  /** Draws into the renderer’s current render target. The objects the highlight pattern matches are drawn again on top, marked, the way the wireframe draws their lines in a pass of their own. */
  draw(renderer: Renderer, scene: Scene, camera: Camera, origin: Vec3, highlight?: string) {
    this.origin.fromArray(origin)
    const hidden: Array<Object3D> = []
    scene.traverseVisible(object => {
      if ('isPoints' in object || 'isLine' in object || 'isSprite' in object) {
        // without triangles they have no centroid, so whatever lies behind them decides
        hidden.push(object)
      }
    })
    const {autoClear} = renderer
    const {background, backgroundNode, overrideMaterial} = scene
    renderer.getClearColor(this.clearColor)
    const clearAlpha = renderer.getClearAlpha()
    const highlighted = highlight ? collectMeshPattern(scene, highlight) : []
    const layerMasks = highlighted.map(object => object.layers.mask)
    const cameraMask = camera.layers.mask
    const restoreGeometry = swapTriangleGeometry(scene)
    try {
      for (const object of hidden) {
        object.visible = false
      }
      scene.background = null
      scene.backgroundNode = null
      scene.overrideMaterial = this.material
      renderer.autoClear = true
      renderer.setClearColor(0x00_00_00, 0)
      renderer.render(scene, camera)
      if (highlighted.length > 0) {
        // the same triangles at the same depth pass the default less-or-equal depth test
        for (const object of highlighted) {
          object.layers.set(highlightLayer)
        }
        camera.layers.set(highlightLayer)
        scene.overrideMaterial = this.highlightMaterial
        renderer.autoClear = false
        renderer.render(scene, camera)
      }
    } finally {
      camera.layers.mask = cameraMask
      for (const [index, object] of highlighted.entries()) {
        object.layers.mask = layerMasks[index]
      }
      renderer.setClearColor(this.clearColor, clearAlpha)
      renderer.autoClear = autoClear
      scene.background = background
      scene.backgroundNode = backgroundNode
      scene.overrideMaterial = overrideMaterial
      for (const object of hidden) {
        object.visible = true
      }
      restoreGeometry()
    }
  }
}
