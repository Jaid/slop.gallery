import type {Portrait} from './types.ts'

import {modelImageType} from '../ai/modelImage.ts'
import downloadBlob from '../downloadBlob.ts'
import {loadBlob} from './actions.ts'

export type PortraitExportFormat = 'png' | 'webp'

const mimeTypes: Record<PortraitExportFormat, string> = {
  png: 'image/png',
  webp: 'image/webp',
}

/** A safe download file name for the portrait in `format`. */
export function portraitFileName(portrait: Pick<Portrait, 'id' | 'title'>, format: PortraitExportFormat): string {
  const stem = portrait.title
    .replaceAll(/[\u{0}-\u{1F}"*/:<>?\\|]+/gu, ' ')
    .replaceAll(/\s+/gu, ' ')
    .replaceAll(/^[\s.]+|[\s.]+$/gu, '')
    .slice(0, 120) || portrait.id
  return `${stem}.${format}`
}

/** Encodes a portrait’s image as PNG or lossless WebP, keeping an image that is already in that format untouched. */
export async function encodePortraitImage(source: Blob | string, format: PortraitExportFormat): Promise<Blob> {
  const blob = await loadBlob(source)
  const mimeType = mimeTypes[format]
  const header = await blob.slice(0, 12).bytes()
  if (modelImageType(header) === mimeType) {
    return blob
  }
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create a 2D canvas context to export the artwork.')
    }
    context.drawImage(bitmap, 0, 0)
    const encoded = await canvas.convertToBlob({
      type: mimeType,
      ...format === 'webp' ? {quality: 1} : {},
    })
    if (encoded.type !== mimeType) {
      throw new Error(`The browser could not encode the artwork as ${format.toUpperCase()}.`)
    }
    return encoded
  } finally {
    bitmap.close()
  }
}

/** Downloads a portrait’s image as PNG or WebP. */
export async function exportPortrait(portrait: Pick<Portrait, 'id' | 'source' | 'title'>, format: PortraitExportFormat): Promise<void> {
  const blob = await encodePortraitImage(portrait.source, format)
  downloadBlob(blob, portraitFileName(portrait, format))
}

/** Copies a portrait’s image to the clipboard as PNG, starting the write right away so the user gesture stays alive while it encodes. */
export async function copyPortraitPng(portrait: Pick<Portrait, 'source'>): Promise<void> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard as Clipboard | undefined
  if (typeof ClipboardItem === 'undefined' || !clipboard || typeof clipboard.write !== 'function') {
    throw new Error('Clipboard image copying is not supported in this browser.')
  }
  const png = encodePortraitImage(portrait.source, 'png')
  await clipboard.write([new ClipboardItem({'image/png': png})])
}
