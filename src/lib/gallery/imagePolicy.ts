import type {Portrait} from './types.ts'

/** the formats an image of a work may come in, by media type, with their file extensions, though an import keeps a WebP of its own, see importedImage */
export const imageExtensions = {
  'image/jxl': ['.jxl'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
  'image/gif': ['.gif'],
}
/** the formats an image may be imported in: those of a work and SVG, which an import draws into its WebP */
export const importExtensions = {
  ...imageExtensions,
  'image/svg+xml': ['.svg'],
}
export const maximumPortraits = 120
export const maximumImageBytes = 25_000_000
export const maximumCollectionImageBytes = 150_000_000

export function validateImage(source: Blob) {
  if (!Object.hasOwn(imageExtensions, source.type) || source.size > maximumImageBytes) {
    throw new Error('Choose JXL, PNG, JPEG, WebP, AVIF or GIF up to 25 mb.')
  }
}

export function validateImport(file: Blob) {
  if (!Object.hasOwn(importExtensions, file.type) || file.size > maximumImageBytes) {
    throw new Error('Choose JXL, PNG, JPEG, WebP, AVIF, GIF or SVG up to 25 mb.')
  }
}

export function validateCollectionImages(portraits: ReadonlyArray<Portrait>) {
  if (portraits.length > maximumPortraits) {
    throw new Error(`The gallery holds ${maximumPortraits} works. Remove a work before adding another.`)
  }
  let bytes = 0
  for (const {source} of portraits) {
    if (!(source instanceof Blob)) {
      continue
    }
    validateImage(source)
    bytes += source.size
  }
  if (bytes > maximumCollectionImageBytes) {
    throw new Error('The collection can hold up to 150 mb of embedded images. Remove a work before adding more.')
  }
}
