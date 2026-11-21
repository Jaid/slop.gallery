import type {TextOverlayInput} from '#src/lib/webmcp/tools.ts'
import type {Camera} from 'three/webgpu'

import './textOverlay.sass'

import {Vector3, WebGPUCoordinateSystem} from 'three/webgpu'

const containerId = 'gallery-text-overlay'

export function addTextOverlay({text, position, anchor = 5}: TextOverlayInput, camera: Camera, canvas: HTMLCanvasElement) {
  let x = position?.x ?? innerWidth / 2
  let y = position?.y ?? innerHeight / 2
  if (position?.z !== undefined) {
    camera.updateWorldMatrix(true, false)
    const point = new Vector3(x, y, position.z)
    point.project(camera)
    const rect = canvas.getBoundingClientRect()
    const minDepth = camera.coordinateSystem === WebGPUCoordinateSystem ? 0 : -1
    if (!(rect.width && rect.height && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z >= minDepth && point.z <= 1)) {
      return {added: false}
    }
    x = rect.left + (point.x + 1) * rect.width / 2
    y = rect.top + (1 - point.y) * rect.height / 2
  }
  let container = document.querySelector<HTMLDivElement>(`#${containerId}`)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    document.body.append(container)
  }
  const label = document.createElement('div')
  label.textContent = text
  label.style.left = `${x}px`
  label.style.top = `${y}px`
  const index = anchor - 1
  label.style.translate = `${-50 * (index % 3)}% ${-50 * Math.floor(index / 3)}%`
  container.append(label)
  return {added: true}
}

export function clearTextOverlay() {
  const container = document.querySelector(`#${containerId}`)
  const count = container?.childElementCount ?? 0
  container?.remove()
  return count
}
