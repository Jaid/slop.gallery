import type {Portrait} from './types.ts'

import {create} from 'zustand'

import downloadBlob from '../downloadBlob.ts'

export type ArtworkExportAction = 'copy' | 'png' | 'webp'
type ExportableArtwork = Pick<Portrait, 'source' | 'title'>

/** Encoding survives closing the pause menu; remounting it must not start another full-size image concurrently. */
export const useArtworkExport = create(() => ({busy: false}))

/** A work’s image, not its frame or a scene screenshot, at the source’s full decoded resolution. */
export async function encodeArtwork(source: Blob | string, format: 'png' | 'webp') {
  let blob: Blob
  if (typeof source === 'string') {
    const response = await fetch(source, {signal: AbortSignal.timeout(20_000)})
    if (!response.ok) {
      throw new Error(`Artwork image HTTP ${response.status}.`)
    }
    blob = await response.blob()
  } else {
    blob = source
  }
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('The image canvas is unavailable.')
    }
    context.drawImage(bitmap, 0, 0)
    const type = `image/${format}`
    const encoded = await canvas.convertToBlob({
      type,
      quality: 0.95,
    })
    if (encoded.type !== type) {
      throw new Error(`The browser cannot encode ${format === 'png' ? 'PNG' : 'WebP'}.`)
    }
    return encoded
  } finally {
    bitmap.close()
  }
}

/** A portable filename without path separators, control characters or an unbounded title. */
export function artworkFileName(title: string, format: 'png' | 'webp') {
  let name = title.replaceAll(/[\p{Cc}"*/:<>?\\|]/gu, '_').trim().slice(0, 120).replace(/[ .]+$/u, '') || 'Artwork'
  if (/^(?:aux|com[1-9]|con|lpt[1-9]|nul|prn)(?:\.|$)/iu.test(name)) {
    name = `_${name}`
  }
  return `${name}.${format}`
}

/** Call from the menu gesture: clipboard permission is requested before decoding or fetching the PNG. */
export async function exportArtwork(artwork: ExportableArtwork, action: ArtworkExportAction) {
  if (useArtworkExport.getState().busy) {
    throw new Error('An artwork is already being exported.')
  }
  useArtworkExport.setState({busy: true})
  try {
    await writeArtwork(artwork, action)
  } finally {
    useArtworkExport.setState({busy: false})
  }
}

async function writeArtwork(artwork: ExportableArtwork, action: ArtworkExportAction) {
  if (action === 'copy') {
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (!globalThis.isSecureContext || !clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('Image copying requires clipboard access on HTTPS or localhost.')
    }
    const png = encodeArtwork(artwork.source, 'png')
    // A denied permission can reject write before it consumes the promised image.
    void png.catch(() => {})
    await clipboard.write([new ClipboardItem({'image/png': png})])
    return
  }
  downloadBlob(await encodeArtwork(artwork.source, action), artworkFileName(artwork.title, action))
}
