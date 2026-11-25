import decodeImage from './decodeImage.ts'
import {validateImportImage} from './imagePolicy.ts'

/** Decodes an image or the first frame of a video for a portrait. A file without a known image MIME type goes to the browser’s media decoder, even if it has no type or extension at all. The caller closes the source after drawing. */
export default async function decodeImport(source: Blob | string) {
  if (typeof source === 'string') {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`The portrait source could not be loaded (HTTP ${response.status}).`)
    }
    if (/^https?:/u.test(response.url) && !response.headers.get('Content-Type')?.toLowerCase().startsWith('image/')) {
      // Let the decoder request byte ranges instead of downloading the whole recording. For data URLs it can sniff a blob even when it refuses the URL’s declared type.
      await response.body?.cancel()
      return decodeVideoFrame(response.url)
    }
    source = await response.blob()
  }
  if (!source.type.startsWith('image/')) {
    return decodeVideoFrame(source)
  }
  validateImportImage(source)
  return decodeImage(source)
}

/** A detached, paused video has its first frame available to draw at loadeddata, without seeking or playing sound. */
async function decodeVideoFrame(source: Blob | string) {
  const video = document.createElement('video')
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  const close = () => {
    video.removeAttribute('src')
    video.load()
    if (typeof source !== 'string') {
      URL.revokeObjectURL(url)
    }
  }
  const {promise, resolve, reject} = Promise.withResolvers<void>()
  const listeners = new AbortController
  // A stalled decoder must not hold up the rest of a drop.
  const timeout = setTimeout(() => reject(new Error('Timed out reading the first video frame.')), 30_000)
  try {
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    video.addEventListener('loadeddata', () => resolve(), {signal: listeners.signal})
    video.addEventListener('error', () => reject(new Error('This browser could not decode a video frame from this file.')), {signal: listeners.signal})
    video.src = url
    await promise
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('This file has no readable video track.')
    }
    return {
      source: video,
      width: video.videoWidth,
      height: video.videoHeight,
      vector: false,
      close,
    }
  } catch (error) {
    close()
    throw error
  } finally {
    clearTimeout(timeout)
    listeners.abort()
  }
}
