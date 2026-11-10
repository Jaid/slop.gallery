import '#src/lib/diagnostics.ts'

import {currentWorldId} from '#src/worlds/index.ts'

import downloadBlob, {fileTimestamp} from './downloadBlob.ts'

export type FrameFormat = 'png' | 'webp'

export type FrameDownload = {
  /** encoded size in bytes */
  bytes: number
  fileName: string
  format: FrameFormat
  height: number
  /** fraction of pixels with any RGB channel above 8, only known for PNG */
  nonBlackFraction?: number
  width: number
}

const defaultName = () => `${currentWorldId}-${fileTimestamp()}`
type EncodedFrame = Pick<FrameDownload, 'height' | 'nonBlackFraction' | 'width'> & {blob: Blob}

const encodePng = async (): Promise<EncodedFrame> => {
  const captureFrame = globalThis.slopGallery?.captureFrame
  if (!captureFrame) {
    throw new Error('WebGPU capture is not mounted.')
  }
  const {image, width, height, nonBlackFraction} = await captureFrame()
  return {
    blob: image,
    width,
    height,
    nonBlackFraction,
  }
}
const encodeWebp = async (): Promise<EncodedFrame> => {
  const capturePixels = globalThis.slopGallery?.capturePixels
  if (!capturePixels) {
    throw new Error('WebGPU capture is not mounted.')
  }
  const {pixels, width, height} = await capturePixels()
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a 2D canvas context for the frame download.')
  }
  context.putImageData(new ImageData(pixels, width, height), 0, 0)
  // Chromium encodes WebP losslessly at quality 1. Browsers without a WebP encoder silently return PNG.
  const blob = await canvas.convertToBlob({
    type: 'image/webp',
    quality: 1,
  })
  if (blob.type !== 'image/webp') {
    throw new Error('The browser could not encode the frame as WebP.')
  }
  return {
    blob,
    width,
    height,
  }
}

/** Download the current frame losslessly as `<name>.<format>`, by default `<world>-<timestamp>.webp`. Rejects when the capture is not mounted or encoding fails. */
export default async function downloadFrame({name = defaultName(), format = 'webp'}: {
  format?: FrameFormat
  name?: string
} = {}): Promise<FrameDownload> {
  const {blob, width, height, nonBlackFraction} = format === 'png' ? await encodePng() : await encodeWebp()
  const fileName = `${name}.${format}`
  downloadBlob(blob, fileName)
  return {
    fileName,
    format,
    width,
    height,
    bytes: blob.size,
    ...nonBlackFraction === undefined ? {} : {nonBlackFraction},
  }
}
