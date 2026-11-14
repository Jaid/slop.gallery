import type {KnotEntry, KnotMaterialLoader} from 'knot-materials/types.ts'
import type {Mesh} from 'three/webgpu'

import createKnotMesh from 'knot-materials/createKnotMesh.ts'
import {createKnotGeometry} from 'knot-materials/geometry.ts'
import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import {HalfFloatType, PerspectiveCamera, RenderTarget, SRGBColorSpace, UnsignedByteType} from 'three/webgpu'

import Studio from '#src/lib/rendering/studio/base/Studio.ts'

const heavyIcon = {
  size: 640,
  supersampling: 2,
}
const fastIcon = {
  size: 320,
  supersampling: 1,
}
const previewFov = 50
const canvas = (width: number, height = width) => Object.assign(document.createElement('canvas'), {
  width,
  height,
})
function visibleBounds({data, width, height}: Pick<ImageData, 'data' | 'height' | 'width'>) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) {
        continue
      }
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right < left ? undefined : [left, top, right - left + 1, bottom - top + 1] as const
}
function releaseCanvases(images: ReadonlyMap<string, HTMLCanvasElement>) {
  for (const image of images.values()) {
    image.width = 0
    image.height = 0
  }
}

/** A studio that takes the Knots’ screenshots for every billboard at runtime, one after another; fast graphics renders the same shaders at a lower resolution. */
export default class RuntimeKnotIconRenderer extends Studio {
  private active?: Mesh
  private readonly camera = new PerspectiveCamera(previewFov, 1, 0.05, 100)
  private readonly environment = new StudioEnvironment
  private readonly geometry = createKnotGeometry()
  private readonly iconSize: number
  private readonly renderSize: number
  private readonly target: RenderTarget
  private readonly validationTarget = new RenderTarget(32, 32, {type: HalfFloatType})

  constructor(
    private readonly load: KnotMaterialLoader,
    heavy: boolean,
  ) {
    super()
    const icon = heavy ? heavyIcon : fastIcon
    this.iconSize = icon.size
    this.renderSize = icon.size * icon.supersampling
    this.target = new RenderTarget(this.renderSize, this.renderSize, {
      type: UnsignedByteType,
      samples: 4,
    })
    this.target.texture.colorSpace = SRGBColorSpace
    this.renderer.setSize(this.renderSize, this.renderSize, false)
    this.camera.position.set(Math.sin(0.18) * 2.1, 0, Math.cos(0.18) * 2.1)
    this.camera.lookAt(0, 0, 0)
  }

  protected override releaseResources() {
    this.releaseMaterial()
    this.validationTarget.dispose()
    this.target.dispose()
    this.geometry.dispose()
    this.environment.dispose()
  }

  async render(entries: ReadonlyArray<KnotEntry>, signal: AbortSignal) {
    if (this.disposed) {
      throw new Error('Runtime knot icon renderer has been disposed.')
    }
    return this.queue(() => this.renderBatch(entries, signal))
  }

  private async capture(id: string) {
    this.setTime(0)
    try {
      this.renderer.setRenderTarget(this.validationTarget)
      this.renderer.render(this.scene, this.camera)
      const hdr = await this.renderer.readRenderTargetPixelsAsync(this.validationTarget, 0, 0, 32, 32) as Uint16Array
      if (hdr.some(value => (value & 0x7C_00) === 0x7C_00)) {
        throw new Error(`${id} produced non-finite HDR pixels.`)
      }
      this.renderer.setOutputRenderTarget(this.target)
      this.renderer.setRenderTarget(this.target)
      this.renderer.render(this.scene, this.camera)
      const {iconSize, renderSize} = this
      const pixels = await this.renderer.readRenderTargetPixelsAsync(this.target, 0, 0, renderSize, renderSize) as Uint8Array
      await this.device.queue.onSubmittedWorkDone()
      if (this.errors.length) {
        throw new Error(`${id}: ${this.errors.join('\n')}`)
      }
      // WebGPU readback rows already have ImageData orientation, unlike WebGL readPixels.
      const data = new ImageData(new Uint8ClampedArray(pixels), renderSize, renderSize)
      const bounds = visibleBounds(data)
      if (!bounds) {
        throw new Error(`${id} produced an empty preview.`)
      }
      const source = canvas(renderSize)
      source.getContext('2d')!.putImageData(data, 0, 0)
      const downsampled = canvas(iconSize)
      const context = downsampled.getContext('2d')!
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(source, 0, 0, iconSize, iconSize)
      source.width = 0
      source.height = 0
      const scale = iconSize / renderSize
      const left = Math.floor(bounds[0] * scale)
      const top = Math.floor(bounds[1] * scale)
      const right = Math.ceil((bounds[0] + bounds[2]) * scale)
      const bottom = Math.ceil((bounds[1] + bounds[3]) * scale)
      const cropped = canvas(right - left, bottom - top)
      cropped.getContext('2d')!.drawImage(downsampled, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
      downsampled.width = 0
      downsampled.height = 0
      return cropped
    } finally {
      this.renderer.setOutputRenderTarget(null)
      this.renderer.setRenderTarget(null)
    }
  }

  private async prepare(item: KnotEntry) {
    if (this.active) {
      throw new Error('A runtime knot icon material is already active.')
    }
    const Material = await this.load(item)
    this.active = createKnotMesh(this.geometry, new Material(this.environment))
    this.active.frustumCulled = false
    this.stage.add(this.active)
    this.errors.length = 0
    try {
      this.renderer.setOutputRenderTarget(this.target)
      this.renderer.setRenderTarget(this.target)
      await this.renderer.compileAsync(this.scene, this.camera)
      this.renderer.setOutputRenderTarget(null)
      this.renderer.setRenderTarget(this.validationTarget)
      await this.renderer.compileAsync(this.scene, this.camera)
    } catch (error) {
      this.releaseMaterial()
      throw error
    } finally {
      this.renderer.setOutputRenderTarget(null)
      this.renderer.setRenderTarget(null)
    }
  }

  private releaseMaterial() {
    if (!this.active) {
      return
    }
    this.stage.remove(this.active)
    const material = this.active.material
    if (Array.isArray(material)) {
      for (const entry of material) {
        entry.dispose()
      }
    } else {
      material.dispose()
    }
    this.active = undefined
  }

  private async renderBatch(entries: ReadonlyArray<KnotEntry>, signal: AbortSignal) {
    signal.throwIfAborted()
    await this.init()
    const images = new Map<string, HTMLCanvasElement>
    try {
      for (const entry of entries) {
        signal.throwIfAborted()
        await this.prepare(entry)
        try {
          images.set(entry.id, await this.capture(entry.id))
        } finally {
          this.releaseMaterial()
        }
      }
      signal.throwIfAborted()
      return images
    } catch (error) {
      releaseCanvases(images)
      throw error
    }
  }
}

export {releaseCanvases}
