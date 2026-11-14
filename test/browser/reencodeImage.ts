import reencodeImage from '../../src/lib/reencodeImage.ts'

const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}
/** The image’s pixels as the browser decodes them. */
const pixels = async (image: Blob) => {
  const bitmap = await createImageBitmap(image)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height).data
  } finally {
    bitmap.close()
  }
}

/**
 * Encodes noise, which no lossy encoder keeps, with a transparent stripe as a PNG and re-encodes it as a PNG and as a WebP of quality 1, like a work’s export does, and checks that both keep every pixel and the alpha.
 * Both kinds of pixel are either opaque or transparent, so premultiplied alpha can’t shift any of them.
 */
export default async function verifyReencodeImage() {
  const width = 517
  const height = 263
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')!
  const noise = context.createImageData(width, height)
  let seed = 1
  for (let index = 0; index < noise.data.length; index += 4) {
    for (let channel = 0; channel < 3; channel++) {
      seed = seed * 1_103_515_245 + 12_345 >>> 0
      noise.data[index + channel] = seed >>> 24
    }
    noise.data[index + 3] = index / 4 % width < 16 ? 0 : 255
  }
  context.putImageData(noise, 0, 0)
  const source = await canvas.convertToBlob({type: 'image/png'})
  const expected = await pixels(source)
  const results = []
  for (const [type, quality] of [['image/png', undefined], ['image/webp', 1]] as const) {
    const encoded = await reencodeImage(source, type, quality)
    assert(encoded.type === type, `${type} came out as ${encoded.type}.`)
    const actual = await pixels(encoded)
    assert(actual.length === expected.length, `${type} changed the size.`)
    const differing = actual.filter((value, index) => value !== expected[index]).length
    assert(differing === 0, `${type} changed ${differing} of ${actual.length} channels.`)
    results.push({
      type,
      bytes: encoded.size,
    })
  }
  return results
}
