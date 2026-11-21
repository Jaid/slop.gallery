import type {LayerOptions} from './layer.ts'
import type {OverlayDepthPipeline} from './obstruction.ts'
import type {OverlayMesh} from './OverlayLayer.ts'
import type {Vec3} from 'math'
import type {Camera, ColorRepresentation, Node, Renderer} from 'three/webgpu'

import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js'
import {materialOpacity, positionWorld} from 'three/tsl'
import {ColorManagement, DoubleSide, Mesh, NoToneMapping, Scene} from 'three/webgpu'

import appendBoxEdges from './boxEdges.ts'
import {defaultLayer, readLayer} from './layer.ts'
import layerOpacity from './layerOpacity.ts'
import {useFrameDepth} from './obstruction.ts'
import OverlayLayer from './OverlayLayer.ts'
import ringEdges from './ringEdges.ts'

export type OverlayStyle = {
  color?: ColorRepresentation
  layer?: string
  name?: string
  /** Higher orders draw over lower ones within the same layer. */
  renderOrder?: number
}
export type OverlayDrawing = {
  /** Remove only this drawing and release its GPU resources. Safe to call twice. */
  remove: () => void
  setStyle: (style: OverlayStyle) => void
}
type Point = Readonly<Vec3>

/** Retained world-space line drawings, shared between independent producers. Draw once over the finished canvas or capture, outside the world’s lighting, reflections and temporal resolve. */
export default class WorldOverlay {
  hasDrawings = () => this.scene.children.length > 0
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private depthRequested = false
  private readonly layers = new Map<string, OverlayLayer>
  private readonly listeners = new Set<() => void>
  private readonly renderers = new WeakMap<Camera, Renderer>
  private readonly scene = new Scene
  constructor() {
    this.addLayer({id: defaultLayer})
  }
  addBox(min: Point, max: Point, style?: OverlayStyle) {
    const edges: Array<number> = []
    appendBoxEdges(edges, min, max)
    return this.addSegments(new Float32Array(edges), style)
  }
  /** A ring in the plane perpendicular to `normal`, horizontal by default. */
  addCircle(center: Point, radius: number, {normal = [0, 1, 0], segments = 64, ...style}: OverlayStyle & {
    normal?: Point
    segments?: number
  } = {}) {
    return this.addSegments(ringEdges(center, radius, normal, segments), style)
  }
  addLayer(options: LayerOptions) {
    readLayer(options)
    if (this.layers.has(options.id)) {
      throw new Error(`Overlay layer already exists: ${options.id}`)
    }
    this.layers.set(options.id, new OverlayLayer(options))
    return options.id
  }
  addLine(from: Point, to: Point, style?: OverlayStyle) {
    return this.addSegments(new Float32Array([...from, ...to]), style)
  }
  /** Mark a place with three crossed lines extending `radius` meters along each world axis. */
  addPoint([x, y, z]: Point, {radius = 0.1, ...style}: OverlayStyle & {radius?: number} = {}) {
    if (!(radius > 0 && Number.isFinite(radius))) {
      throw new RangeError('A point marker needs a positive finite radius.')
    }
    return this.addSegments(new Float32Array([x - radius, y, z, x + radius, y, z, x, y - radius, z, x, y + radius, z, x, y, z - radius, x, y, z + radius]), style)
  }
  /** Add a batch in one draw call. Each six consecutive numbers are two endpoints in world meters. Treat the supplied buffer as immutable. */
  addSegments(positions: Float32Array, style?: OverlayStyle): OverlayDrawing {
    return this.stroke(positions, style)
  }

  /** A world-sized ring parallel to the image plane of whichever camera draws it. */
  addSphere(center: Point, radius: number, {segments = 64, ...style}: OverlayStyle & {segments?: number} = {}) {
    return this.stroke(ringEdges([0, 0, 0], radius, [0, 0, 1], segments), style, center)
  }
  /** Transfer a producer's mesh, geometry and material to the overlay. Its own fill/color nodes are preserved, and layer visibility multiplies its opacity. */
  addSurface(layerId: string, mesh: OverlayMesh) {
    const layer = this.layer(layerId)
    const material = mesh.material
    material.opacityNode = layerOpacity((material.opacityNode as Node<'float'> | null) ?? materialOpacity, positionWorld, layer.options)
    material.depthTest = false
    material.depthWrite = false
    material.toneMapped = false
    material.transparent = true
    material.side = DoubleSide
    material.forceSinglePass = true
    this.place(layer, mesh)
    this.changed()
    return () => {
      if (!mesh.parent) {
        return
      }
      layer.release(mesh)
      this.changed()
    }
  }
  addTriangle(a: Point, b: Point, c: Point, style?: OverlayStyle) {
    return this.addSegments(new Float32Array([...a, ...b, ...b, ...c, ...c, ...a]), style)
  }
  attach(camera: Camera, renderer: Renderer) {
    this.renderers.set(camera, renderer)
    return () => {
      this.renderers.delete(camera)
    }
  }

  clearDrawings() {
    let count = 0
    for (const layer of this.layers.values()) {
      count += layer.empty()
    }
    if (count) {
      this.changed()
    }
    return count
  }
  /** Clear drawings, keeping layer definitions for the next producer. */
  clearLayer(id: string) {
    const count = this.layer(id).empty()
    if (count) {
      this.changed()
    }
    return count
  }
  draw(camera: Camera, pipeline?: OverlayDepthPipeline | null) {
    const renderer = this.renderers.get(camera)
    if (!renderer || !this.hasDrawings()) {
      return
    }
    if (this.depthRequested) {
      useFrameDepth(pipeline, camera)
    }
    const {autoClear, outputColorSpace, toneMapping} = renderer
    try {
      renderer.autoClear = false
      renderer.outputColorSpace = ColorManagement.workingColorSpace
      renderer.toneMapping = NoToneMapping
      renderer.render(this.scene, camera)
    } finally {
      renderer.autoClear = autoClear
      renderer.outputColorSpace = outputColorSpace
      renderer.toneMapping = toneMapping
    }
  }
  needsDepth(camera: Camera) {
    return this.depthRequested && this.renderers.has(camera)
  }
  private changed() {
    this.depthRequested = this.scene.children.some(layer => (layer as OverlayLayer).needsDepth)
    for (const listener of this.listeners) {
      listener()
    }
  }

  private layer(id: string) {
    const layer = this.layers.get(id)
    if (!layer) {
      throw new Error(`Unknown overlay layer: ${id}`)
    }
    return layer
  }
  private place(layer: OverlayLayer, mesh: OverlayMesh) {
    layer.add(mesh)
    if (!layer.parent) {
      this.scene.add(layer)
    }
  }
  private stroke(positions: Float32Array, {color, name = '', renderOrder = 0, layer: layerId = defaultLayer}: OverlayStyle = {}, billboardCenter?: Point): OverlayDrawing {
    if (!positions.length || positions.length % 6 !== 0) {
      throw new RangeError('Overlay segments need one or more pairs of xyz endpoints.')
    }
    let layer = this.layer(layerId)
    const geometry = new LineSegmentsGeometry
    geometry.setPositions(positions)
    geometry.setDrawRange(6, 6) // the central quad, without cap triangles
    const mesh = new Mesh(geometry, layer.materialFor(color))
    if (billboardCenter) {
      mesh.position.set(...billboardCenter)
      mesh.onBeforeRender = (_renderer, _scene, camera) => {
        // Parallel to the whole image, not aimed at the eye: even an off-center sphere stays round.
        camera.getWorldQuaternion(mesh.quaternion)
        mesh.updateMatrixWorld()
      }
    }
    mesh.name = name
    mesh.renderOrder = renderOrder
    this.place(layer, mesh)
    this.changed()
    return {
      setStyle: style => {
        if (!mesh.parent) {
          return
        }
        const next = style.layer === undefined ? layer : this.layer(style.layer)
        if (next !== layer) {
          layer.detach(mesh)
          layer = next
          color = style.color ?? color
          mesh.material = layer.materialFor(color)
          this.place(layer, mesh)
        } else if (style.color !== undefined) {
          color = style.color
          if (mesh.material === layer.material) {
            mesh.material = layer.materialFor(color)
          } else {
            mesh.material.color.set(color)
          }
        }
        mesh.name = style.name ?? mesh.name
        mesh.renderOrder = style.renderOrder ?? mesh.renderOrder
        this.changed()
      },
      remove: () => {
        if (!mesh.parent) {
          return
        }
        layer.release(mesh)
        this.changed()
      },
    }
  }
}
