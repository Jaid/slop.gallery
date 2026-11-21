import type {Camera, Material, Mesh, Object3D, Renderer, Scene} from 'three/webgpu'
import type {Arrayable} from 'type-fest'

import {abs, attribute, fwidth, min, mix, normalView, uniform} from 'three/tsl'
import {Color, DoubleSide, MeshBasicNodeMaterial, RenderPipeline} from 'three/webgpu'

import {collectMeshPath} from './meshPath.ts'
import {barycentricName, swapTriangleGeometry} from './triangleGeometry.ts'
import wireframeCoverage from './wireframeCoverage.ts'

// a layer nothing else uses, for drawing the highlighted lines in a pass of their own
const highlightLayer = 31
/** Whether the object is a mesh without positions, like one holding an empty placeholder geometry: it has no triangles to outline, and three can’t build a wireframe index for it. */
const isPositionless = (object: Object3D) => Boolean((object as Partial<Mesh>).isMesh) && !('position' in (object as Mesh).geometry.attributes)
/** Takes every visible mesh without positions off all layers and returns a function that puts them back. Unlike hiding them, this still draws their children. */
function setAsidePositionless(scene: Scene) {
  const positionless: Array<[Object3D, number]> = []
  scene.traverseVisible(object => {
    if (isPositionless(object)) {
      positionless.push([object, object.layers.mask])
      object.layers.disableAll()
    }
  })
  return () => {
    for (const [object, mask] of positionless) {
      object.layers.mask = mask
    }
  }
}

/** Hidden-line wireframe for eyeballing polygon density. The default barycentric line style draws each face’s edges as part of its fill, from each fragment’s distance to its triangle’s edges, antialiased and exactly at the surface’s depth, so only the triangles of visible surfaces show and edges never break up where surfaces nearly touch. The lines style instead lets a depth-writing fill pass occlude the edges of a following pass of 1 px hardware lines. All overrides inherit each material’s `positionNode`, so displaced surfaces keep their real shape, while meshes without positions sit out. With highlight paths, the objects at their ends are drawn in blue and everything else in red; paths and colors can change from frame to frame. Faces are shaded by their angle to the camera, from black when seen edge-on to a share of their line color when facing it. */
export default class WireframeRenderPipeline extends RenderPipeline {
  /** percent of the line color a face shows when facing the camera; edge-on faces are black */
  angleIndicatorStrength = 0
  /** color behind the wireframe, where no surface is, as #rgb or #rrggbb; without one, the renderer’s clear color */
  background: string | undefined
  /** line color of everything not highlighted; without one, red beside highlights and white otherwise */
  color: string | undefined
  /** mesh paths whose objects draw in the highlight color; empty draws every line in the regular color */
  highlight: Array<string>
  /** line color of the highlighted objects; blue without one */
  highlightColor: string | undefined
  /** barycentric draws antialiased edges of any width as part of the fill; lines draws 1 px hardware lines over the fill */
  lineStyle: 'barycentric' | 'lines' = 'barycentric'
  /** Width in render pixels, fixed or resolved for the current render target before drawing. Shared between the two triangles along the edge. */
  lineWidth: ((renderer: Renderer) => number) | number = 0.5
  private readonly angleIndicator = uniform(0)
  private readonly backgroundColor = new Color
  private readonly barycentricFill: MeshBasicNodeMaterial
  private readonly barycentricHighlightFill: MeshBasicNodeMaterial
  private readonly camera: Camera
  private readonly fill: MeshBasicNodeMaterial
  private readonly halfLineWidth = uniform(0.25)
  private readonly highlightFill: MeshBasicNodeMaterial
  private readonly highlightLineColor = uniform(new Color)
  private readonly highlightLines = new MeshBasicNodeMaterial({
    colorNode: this.highlightLineColor,
    depthWrite: false,
    fog: false,
    forceSinglePass: true,
    side: DoubleSide,
    wireframe: true,
  })
  private readonly lineColor = uniform(new Color)
  private readonly lines: MeshBasicNodeMaterial
  private readonly scene: Scene

  constructor(renderer: Renderer, scene: Scene, camera: Camera, highlight: Arrayable<string> = []) {
    super(renderer)
    this.scene = scene
    this.camera = camera
    this.highlight = [highlight].flat()
    // Pushed back slightly so coplanar lines of the visible surface win the depth test.
    const fill = (lineColor: typeof this.lineColor) => new MeshBasicNodeMaterial({
      colorNode: lineColor.mul(abs(normalView.z).mul(this.angleIndicator)),
      fog: false,
      forceSinglePass: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: DoubleSide,
    })
    this.fill = fill(this.lineColor)
    this.highlightFill = fill(this.highlightLineColor)
    const barycentric = attribute<'vec3'>(barycentricName, 'vec3')
    const pixels = barycentric.div(fwidth(barycentric))
    const coverage = wireframeCoverage(min(min(pixels.x, pixels.y), pixels.z), this.halfLineWidth)
    const barycentricFill = (lineColor: typeof this.lineColor) => new MeshBasicNodeMaterial({
      colorNode: mix(lineColor.mul(abs(normalView.z).mul(this.angleIndicator)), lineColor, coverage),
      fog: false,
      forceSinglePass: true,
      side: DoubleSide,
    })
    this.barycentricFill = barycentricFill(this.lineColor)
    this.barycentricHighlightFill = barycentricFill(this.highlightLineColor)
    this.lines = new MeshBasicNodeMaterial({
      colorNode: this.lineColor,
      depthWrite: false,
      fog: false,
      forceSinglePass: true,
      side: DoubleSide,
      wireframe: true,
    })
    this.fill.name = 'WireframeVision.fill'
    this.highlightFill.name = 'WireframeVision.highlightFill'
    this.barycentricFill.name = 'WireframeVision.barycentricFill'
    this.barycentricHighlightFill.name = 'WireframeVision.barycentricHighlightFill'
    this.lines.name = 'WireframeVision.lines'
    this.highlightLines.name = 'WireframeVision.highlightLines'
  }

  override dispose() {
    super.dispose()
    this.fill.dispose()
    this.highlightFill.dispose()
    this.barycentricFill.dispose()
    this.barycentricHighlightFill.dispose()
    this.lines.dispose()
    this.highlightLines.dispose()
  }

  /** Draws the wireframe into the renderer’s current render target, so other pipelines can use it as a layer. */
  draw() {
    const {camera, renderer, scene} = this
    const {autoClear} = renderer
    const {background, backgroundNode, overrideMaterial} = scene
    this.lineColor.value.set(this.color ?? (this.highlight.length > 0 ? '#ff1515' : '#fff'))
    this.highlightLineColor.value.set(this.highlightColor ?? '#2f7bff')
    this.angleIndicator.value = this.angleIndicatorStrength / 100
    this.halfLineWidth.value = (typeof this.lineWidth === 'number' ? this.lineWidth : this.lineWidth(renderer)) / 2
    const barycentric = this.lineStyle === 'barycentric'
    const restoreGeometry = barycentric ? swapTriangleGeometry(scene) : undefined
    const restorePositionless = setAsidePositionless(scene)
    try {
      // A background node, like the gallery’s procedural sky, takes precedence over the plain background color.
      scene.backgroundNode = null
      scene.background = this.background === undefined ? null : this.backgroundColor.set(this.background)
      // Without a background color, only autoClear clears to the renderer’s clear color.
      renderer.autoClear = true
      scene.overrideMaterial = barycentric ? this.barycentricFill : this.fill
      renderer.render(scene, camera)
      // A null background keeps the later passes from clearing or painting a skybox over the fill.
      scene.background = null
      renderer.autoClear = false
      if (this.highlight.length > 0) {
        this.renderHighlighted(this.highlight, barycentric)
      } else if (!barycentric) {
        scene.overrideMaterial = this.lines
        renderer.render(scene, camera)
      }
    } finally {
      restorePositionless()
      restoreGeometry?.()
      renderer.autoClear = autoClear
      scene.background = background
      scene.backgroundNode = backgroundNode
      scene.overrideMaterial = overrideMaterial
    }
  }

  override render() {
    this.draw()
  }

  /** The highlighted fill and the line pass in two colors: the highlighted objects move to a layer of their own, so their fill is drawn again over the regular one at the same depth, the regular lines skip them and a last pass draws only their lines. Barycentric edges come with the fill, so they need no line passes. Looked up every frame, since meshes can mount after the pipeline starts. */
  private renderHighlighted(paths: Array<string>, barycentric: boolean) {
    const {camera, renderer, scene} = this
    // Moving to the highlight layer would draw the meshes without positions again.
    const highlighted: Array<Object3D> = [...new Set(paths.flatMap(path => collectMeshPath(scene, path)))].filter(object => !isPositionless(object))
    const layerMasks = highlighted.map(object => object.layers.mask)
    const cameraMask = camera.layers.mask
    const renderLayer = (material: Material, mask: number) => {
      scene.overrideMaterial = material
      camera.layers.mask = mask
      renderer.render(scene, camera)
    }
    try {
      for (const object of highlighted) {
        object.layers.set(highlightLayer)
      }
      renderLayer(barycentric ? this.barycentricHighlightFill : this.highlightFill, 1 << highlightLayer >>> 0)
      if (!barycentric) {
        renderLayer(this.lines, cameraMask)
        renderLayer(this.highlightLines, 1 << highlightLayer >>> 0)
      }
    } finally {
      camera.layers.mask = cameraMask
      for (const [index, object] of highlighted.entries()) {
        object.layers.mask = layerMasks[index]
      }
    }
  }
}
