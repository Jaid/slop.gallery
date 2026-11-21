import type {TextOverlayInput} from '#src/lib/webmcp/tools.ts'
import type {Camera} from 'three/webgpu'

import {Vector3, WebGPUCoordinateSystem} from 'three/webgpu'

import css from './style.module.sass'

/** Fixed HTML labels owned by this bridge. Only world anchors need a frame loop. */
export default class TextOverlays {
  private readonly anchors = new Map<HTMLElement, Vector3>
  private frame?: number
  private readonly labels = new Set<HTMLElement>
  private readonly projected = new Vector3

  private readonly tick = () => {
    this.project()
    this.frame = requestAnimationFrame(this.tick)
  }

  constructor(private readonly camera: Camera, private readonly canvas: HTMLCanvasElement) {}

  add({text, position, anchor = 5}: TextOverlayInput) {
    const label = document.createElement('div')
    const id = crypto.randomUUID()
    label.dataset.textOverlay = id
    label.className = css.label
    // Translate by fractions of the label's own size: 7 is top left and 3 is bottom right.
    label.style.translate = `${-50 * ((anchor - 1) % 3)}% ${-50 * Math.floor((9 - anchor) / 3)}%`
    label.textContent = text
    this.labels.add(label)
    document.body.append(label)
    if (position?.z !== undefined) {
      this.anchors.set(label, new Vector3(position.x, position.y, position.z))
      this.project()
      this.frame ??= requestAnimationFrame(this.tick)
    } else if (position) {
      label.style.left = `${position.x}px`
      label.style.top = `${position.y}px`
    }
    return {id}
  }

  clear() {
    const count = this.labels.size
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame)
      this.frame = undefined
    }
    for (const label of this.labels) {
      label.remove()
    }
    this.labels.clear()
    this.anchors.clear()
    return count
  }

  private project() {
    // Fixed positioning uses the viewport's CSS pixels, including letterbox offsets, not drawing-buffer pixels.
    const {left, top, width, height} = this.canvas.getBoundingClientRect()
    this.camera.updateWorldMatrix(true, false)
    const minDepth = this.camera.coordinateSystem === WebGPUCoordinateSystem ? 0 : -1
    for (const [label, anchor] of this.anchors) {
      const {x, y, z} = this.projected.copy(anchor).project(this.camera)
      label.hidden = !(width > 0 && height > 0 && Math.abs(x) <= 1 && Math.abs(y) <= 1 && z >= minDepth && z <= 1)
      if (label.hidden) {
        continue
      }
      label.style.left = `${left + (x + 1) * width / 2}px`
      label.style.top = `${top + (1 - y) * height / 2}px`
    }
  }
}
