import type {LayerOptions} from './layer.ts'
import type {Vec3} from 'math'
import type {Camera, ColorRepresentation, Renderer} from 'three/webgpu'

import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js'
import {ColorManagement, Mesh, NoToneMapping, Scene, Vector3} from 'three/webgpu'

import appendBoxEdges from './boxEdges.ts'
import {defaultLayer, readLayer} from './layer.ts'
import OverlayLayer from './OverlayLayer.ts'

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
    const n = new Vector3(...normal)
    if (!(radius > 0 && Number.isFinite(radius) && Number.isInteger(segments) && segments >= 3 && n.lengthSq() > 0 && Number.isFinite(n.lengthSq()))) {
      throw new RangeError('A circle needs a positive finite radius, a finite nonzero normal and at least three segments.')
    }
    n.normalize()
    const u = Math.abs(n.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
    u.cross(n).normalize()
    const v = n.clone().cross(u)
    const edges = new Float32Array(segments * 6)
    const point = new Vector3
    for (let i = 0; i < segments; i++) {
      const angle = i * 2 * Math.PI / segments
      point.set(...center).addScaledVector(u, radius * Math.cos(angle)).addScaledVector(v, radius * Math.sin(angle))
      point.toArray(edges, i * 6)
      point.toArray(edges, (i + segments - 1) % segments * 6 + 3)
    }
    return this.addSegments(edges, style)
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
  addSegments(positions: Float32Array, {color, name = '', renderOrder = 0, layer: layerId = defaultLayer}: OverlayStyle = {}): OverlayDrawing {
    if (!positions.length || positions.length % 6 !== 0) {
      throw new RangeError('Overlay segments need one or more pairs of xyz endpoints.')
    }
    let layer = this.layer(layerId)
    const geometry = new LineSegmentsGeometry
    geometry.setPositions(positions)
    geometry.setDrawRange(6, 6) // the central quad, without cap triangles
    const mesh = new Mesh(geometry, layer.materialFor(color))
    mesh.name = name
    mesh.renderOrder = renderOrder
    layer.add(mesh)
    if (!layer.parent) {
      this.scene.add(layer)
    }
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
          layer.add(mesh)
          if (!layer.parent) {
            this.scene.add(layer)
          }
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
        layer.detach(mesh)
        geometry.dispose()
        this.changed()
      },
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
  draw(camera: Camera) {
    const renderer = this.renderers.get(camera)
    if (!renderer || !this.hasDrawings()) {
      return
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

  private changed() {
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
}
