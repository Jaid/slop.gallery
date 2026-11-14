import type {Portrait} from './types.ts'

import downloadBlob from '../downloadBlob.ts'
import {loadBlob} from './actions.ts'

/** the formats a work exports to */
export type ArtworkExportFormat = 'png' | 'webp'

const types = {
  png: 'image/png',
  webp: 'image/webp',
} as const satisfies Record<ArtworkExportFormat, string>

/** The name a download of the work as `format` goes by: its title as a slug of at most 80 letters and digits, or its id where the title has none. */
export function artworkFileName(portrait: Pick<Portrait, 'id' | 'title'>, format: ArtworkExportFormat) {
  const slug = portrait.title.normalize('NFKD').replaceAll(/\p{M}/gu, '').toLowerCase().replaceAll(/[^0-9a-z]+/gu, '-').replaceAll(/^-+|-+$/gu, '').slice(0, 80).replace(/-+$/u, '')
  return `${slug || portrait.id || 'artwork'}.${format}`
}

/** The work’s image re-encoded as `format` at its own size, decoded by the browser, which takes every format the page shows, like JXL and AVIF. Rejects where the browser cannot encode the format. */
export async function convertArtwork(source: Blob | string, format: ArtworkExportFormat): Promise<Blob> {
  const bitmap = await createImageBitmap(await loadBlob(source))
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create a 2D canvas context to export an artwork.')
    }
    context.drawImage(bitmap, 0, 0)
    const blob = await canvas.convertToBlob({
      type: types[format],
      ...format === 'webp' ? {quality: 0.95} : {},
    })
    if (blob.type !== types[format]) {
      throw new Error(`The artwork could not be encoded as ${format === 'png' ? 'PNG' : 'WebP'}.`)
    }
    return blob
  } finally {
    bitmap.close()
  }
}

/** Saves the work’s image as a download of `format` and returns the file name it goes by. */
export async function downloadArtwork(portrait: Portrait, format: ArtworkExportFormat) {
  const fileName = artworkFileName(portrait, format)
  downloadBlob(await convertArtwork(portrait.source, format), fileName)
  return fileName
}

/** Copies the work’s image to the clipboard as a PNG. The clipboard item is made before the first await, so the copy stays tied to the click that asked for it while the image encodes. */
export async function copyArtwork(portrait: Portrait) {
  const item = new ClipboardItem({'image/png': convertArtwork(portrait.source, 'png')})
  await navigator.clipboard.write([item])
}
