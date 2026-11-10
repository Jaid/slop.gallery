import type {CaptureFrame, CaptureFrameApi, CaptureFrameResult, CapturePixels, RgbaFrame, WebgpuCaptureOptions} from './types.ts'

import {RenderTarget, RGBAFormat, UnsignedByteType, Vector2} from 'three/webgpu'

import encodePng from './encodePng.ts'
import {analyzeFrame, unpackRgba, validateSize} from './pixels.ts'

/** Owns one reusable capture target, but never the renderer, scene or pipeline. */
export default class WebgpuCapture implements CaptureFrameApi, Disposable {
  /** Concurrent callers share the same frame and promise. Safe to pass as a callback. */
  readonly captureFrame: CaptureFrame = () => {
    if (this.disposed) {
      return Promise.reject(new Error('WebGPU capture has been disposed.'))
    }
    return this.inFlight ??= this.capture(async () => {
      const frame = await this.readFrame()
      const analysis = analyzeFrame(frame)
      const image = await (this.options.encode ?? encodePng)(frame)
      return {
        ...analysis,
        image,
        width: frame.width,
        height: frame.height,
      }
    }, () => {
      this.inFlight = null
    })
  }
  /** Like captureFrame, but resolves with the raw pixels and skips statistics and encoding, e.g. for video frames. */
  readonly capturePixels: CapturePixels = () => {
    if (this.disposed) {
      return Promise.reject(new Error('WebGPU capture has been disposed.'))
    }
    return this.pixelsInFlight ??= this.capture(() => this.readFrame(), () => {
      this.pixelsInFlight = null
    })
  }
  private disposed = false
  private inFlight: Promise<CaptureFrameResult> | null = null
  private readonly options: WebgpuCaptureOptions
  private pixelsInFlight: Promise<RgbaFrame> | null = null
  private readonly size = new Vector2

  private target: RenderTarget | null = null

  constructor(options: WebgpuCaptureOptions) {
    const backend = options.renderer.backend
    if (!('isWebGPUBackend' in backend) || backend.isWebGPUBackend !== true) {
      throw new Error('WebgpuCapture requires a native WebGPU renderer.')
    }
    if (options.pipeline && options.pipeline.renderer !== options.renderer) {
      throw new Error('The capture pipeline must belong to the capture renderer.')
    }
    this.options = {...options}
  }

  /** Reject new captures immediately; release GPU resources after any pending capture settles. */
  dispose() {
    this.disposed = true
    if (!this.inFlight && !this.pixelsInFlight) {
      this.releaseTarget()
    }
  }

  [Symbol.dispose]() {
    this.dispose()
  }

  private async capture<T>(read: () => Promise<T>, settle: () => void): Promise<T> {
    // Register the shared promise before rendering, including synchronous failures.
    await Promise.resolve()
    try {
      return await read()
    } finally {
      settle()
      if (this.disposed && !this.inFlight && !this.pixelsInFlight) {
        this.releaseTarget()
      }
    }
  }

  private async readFrame(): Promise<RgbaFrame> {
    const {around, renderer, scene, camera, pipeline} = this.options
    const {width, height} = renderer.getDrawingBufferSize(this.size)
    validateSize(width, height)
    this.target ??= new RenderTarget(width, height, {
      depthBuffer: renderer.depth,
      stencilBuffer: renderer.stencil,
      samples: renderer.samples,
      format: RGBAFormat,
      type: UnsignedByteType,
    })
    const target = this.target
    target.setSize(width, height)
    const previousTarget = renderer.getRenderTarget()
    const previousOutputTarget = renderer.getOutputRenderTarget()
    const previousCubeFace = renderer.getActiveCubeFace()
    const previousMipmapLevel = renderer.getActiveMipmapLevel()
    const previousAutoClear = renderer.autoClear
    let pendingReadback: ReturnType<typeof renderer.readRenderTargetPixelsAsync>
    try {
      // An output target preserves screen tone mapping and color conversion for direct scene renders.
      renderer.setOutputRenderTarget(target)
      renderer.setRenderTarget(null)
      renderer.autoClear = true
      const render = () => {
        if (pipeline) {
          pipeline.render()
        } else {
          renderer.render(scene, camera)
        }
      }
      if (around) {
        around(render, camera)
      } else {
        render()
      }
      pendingReadback = renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height)
    } finally {
      // Restore synchronously: the ordinary render loop must not draw into our target while mapping.
      renderer.setOutputRenderTarget(previousOutputTarget)
      renderer.setRenderTarget(previousTarget, previousCubeFace, previousMipmapLevel)
      renderer.autoClear = previousAutoClear
    }
    const readback = await pendingReadback
    if (!(readback instanceof Uint8Array)) {
      throw new TypeError('Expected an RGBA8 WebGPU readback.')
    }
    return unpackRgba(readback, width, height)
  }

  private releaseTarget() {
    const target = this.target
    this.target = null
    target?.dispose()
  }
}
