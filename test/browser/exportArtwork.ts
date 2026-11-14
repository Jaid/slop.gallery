import {encodeArtwork} from '../../src/lib/gallery/exportArtwork.ts'

const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

/** Full-size source-image conversion without a scene, DOM, GPU or clipboard permission. */
export default async function verify() {
  const width = 4097
  const height = 13
  const original = new OffscreenCanvas(width, height)
  const context = original.getContext('2d')!
  context.fillStyle = '#c42841'
  context.fillRect(0, 0, width, height / 2)
  context.fillStyle = '#205be8'
  context.fillRect(0, height / 2, width, height)
  context.clearRect(0, 0, 8, height)
  const source = await original.convertToBlob({type: 'image/png'})
  const url = URL.createObjectURL(source)
  const results = []
  const decoder = new TextDecoder
  try {
    for (const input of [source, url]) {
      for (const format of ['png', 'webp'] as const) {
        const encoded = await encodeArtwork(input, format)
        const bytes = new Uint8Array(await encoded.arrayBuffer())
        assert(encoded.type === `image/${format}`, 'Wrong output MIME type')
        if (format === 'png') {
          assert(bytes.slice(0, 8).join() === '137,80,78,71,13,10,26,10', 'Not PNG bytes')
        } else {
          assert(decoder.decode(bytes.slice(0, 4)) === 'RIFF' && decoder.decode(bytes.slice(8, 12)) === 'WEBP', 'Not WebP bytes')
        }
        const bitmap = await createImageBitmap(encoded)
        try {
          assert(bitmap.width === width && bitmap.height === height, 'Source dimensions changed')
          const canvas = new OffscreenCanvas(width, height)
          const decoded = canvas.getContext('2d')!
          decoded.drawImage(bitmap, 0, 0)
          assert(decoded.getImageData(2, 2, 1, 1).data[3] === 0, 'Alpha lost')
          for (const [x, y] of [[40, 1], [width - 40, height - 2]]) {
            const expected = context.getImageData(x, y, 1, 1).data
            const actual = decoded.getImageData(x, y, 1, 1).data
            assert(expected.every((value, index) => Math.abs(value - actual[index]) <= (format === 'png' ? 0 : 10)), 'Colors or orientation changed')
          }
        } finally {
          bitmap.close()
        }
        results.push({
          input: typeof input === 'string' ? 'URL' : 'Blob',
          format,
          bytes: bytes.length,
          width,
          height,
        })
      }
    }
  } finally {
    URL.revokeObjectURL(url)
  }
  return results
}
