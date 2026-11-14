import reencodeImage from '../reencodeImage.ts'

/** the file signatures of the image formats every image model takes, each at its offset into the file */
const signatures = {
  'image/png': [[0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]],
  'image/jpeg': [[0, [0xFF, 0xD8, 0xFF]]],
  // RIFF, then the size, then WEBP
  'image/webp': [[0, [0x52, 0x49, 0x46, 0x46]], [8, [0x57, 0x45, 0x42, 0x50]]],
} as const satisfies Record<string, ReadonlyArray<readonly [number, ReadonlyArray<number>]>>
export type ModelImageType = keyof typeof signatures

/** The format of the image by its file signature, if image models take it as it is: PNG, JPEG or WebP. Media types can’t be trusted for this; a JXL served as `image/png` is still a JXL. */
export function modelImageType(bytes: Uint8Array): ModelImageType | undefined {
  return (Object.keys(signatures) as Array<ModelImageType>).find(type => signatures[type].every(([offset, signature]) => signature.every((byte, index) => bytes[offset + index] === byte)))
}

/** The image as a lossy WebP of the same size, decoded by the browser, which takes every format the page shows, like JXL and AVIF. */
export async function toWebp(image: Blob): Promise<Blob> {
  return reencodeImage(image, 'image/webp', 0.95)
}

/** The bytes of the image as an image model takes them: PNG, JPEG and WebP as they are, anything else re-encoded with `encode`, to WebP by default. */
export default async function modelImage(image: Blob, encode: (image: Blob) => Promise<Blob> = toWebp): Promise<Uint8Array> {
  const bytes = await image.bytes()
  if (modelImageType(bytes)) {
    return bytes
  }
  const reencoded = await encode(image)
  const encoded = await reencoded.bytes()
  if (!modelImageType(encoded)) {
    throw new Error('An image could not be re-encoded into a format image models take.')
  }
  return encoded
}
