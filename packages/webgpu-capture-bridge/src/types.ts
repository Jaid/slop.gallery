import type {Camera, RenderPipeline, Scene, WebGPURenderer} from 'three/webgpu'

export type RgbaFrame = {
  height: number
  /** Tightly packed, top-to-bottom RGBA8 pixels. */
  pixels: Uint8ClampedArray<ArrayBuffer>
  width: number
}

export type CaptureFrameResult = {
  centerPixel: [number, number, number, number]
  height: number
  /** The encoded frame, PNG with the default encoder. */
  image: Blob
  /** Rec. 709 weighted RGB bytes, in the range 0–255; not linear-light luminance. */
  meanLuminance: number
  /** Fraction of pixels with at least one RGB channel greater than 8. Alpha is ignored. */
  nonBlackFraction: number
  width: number
}

export type CaptureFrame = () => Promise<CaptureFrameResult>

export type CapturePixels = () => Promise<RgbaFrame>

export type CaptureFrameApi = {
  captureFrame: CaptureFrame
  capturePixels: CapturePixels
}

export type FrameEncoder = (frame: RgbaFrame) => Blob | Promise<Blob>

/** Runs a capture’s own render, which it must call exactly once and synchronously, e.g. between preparing the camera for it and restoring it. */
export type CaptureRenderWrap = (render: () => void, camera: Camera) => void

export type WebgpuCaptureOptions = {
  /** Wraps every capture’s render, for whatever the application’s own frames set up around theirs. */
  around?: CaptureRenderWrap
  camera: Camera
  /** Defaults to PNG encoding with an OffscreenCanvas. */
  encode?: FrameEncoder
  pipeline?: RenderPipeline | null
  renderer: WebGPURenderer
  scene: Scene
}
