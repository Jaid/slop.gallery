/** the media types the browser encodes images to */
export type EncodedImageType = 'image/png' | 'image/webp'

/**
 * The image at the same size in another format, decoded by the browser, which takes every format the page shows, like JXL and AVIF.
 * @param quality from 0 to 1 for a lossy format, which PNG ignores; the browser’s default if left out
 */
export default async function reencodeImage(image: Blob, type: EncodedImageType, quality?: number): Promise<Blob> {
  const bitmap = await createImageBitmap(image)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create a 2D canvas context to re-encode an image.')
    }
    context.drawImage(bitmap, 0, 0)
    const encoded = await canvas.convertToBlob({
      type,
      quality,
    })
    // Browsers without an encoder for the format silently return PNG.
    if (encoded.type !== type) {
      throw new Error(`The browser could not encode the image as ${type}.`)
    }
    return encoded
  } finally {
    bitmap.close()
  }
}
