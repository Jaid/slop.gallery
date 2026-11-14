import {afterEach, beforeEach, expect, mock, test} from 'bun:test'

import {artworkFileName, encodeArtwork, exportArtwork} from '../../src/lib/gallery/exportArtwork.ts'

const keys = ['fetch', 'createImageBitmap', 'OffscreenCanvas', 'ClipboardItem', 'navigator', 'isSecureContext'] as const
const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
const install = (key: typeof keys[number], value: unknown) => Object.defineProperty(globalThis, key, {
  configurable: true,
  writable: true,
  value,
})
let close = mock(() => {})
let draw = mock(() => {})
let encode = mock(async ({type}: {type: string}) => new Blob(['encoded'], {type}))
let dimensions: Array<number>
let bitmap: ImageBitmap
const source = new Blob(['original'], {type: 'image/png'})
beforeEach(() => {
  close = mock(() => {})
  draw = mock(() => {})
  encode = mock(async ({type}: {type: string}) => new Blob(['encoded'], {type}))
  dimensions = []
  bitmap = {
    width: 8192,
    height: 4096,
    close,
  }
  install('createImageBitmap', mock(async () => bitmap))
  install('OffscreenCanvas', class {
    convertToBlob = encode
    constructor(width: number, height: number) {
      dimensions = [width, height]
    }
    getContext() {
      return {drawImage: draw}
    }
  })
  install('isSecureContext', true)
})
afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
})
test.each(['png', 'webp'] as const)('encodes actual %s bytes from a Blob at full source resolution and releases the bitmap', async format => {
  const result = await encodeArtwork(source, format)
  expect(dimensions).toEqual([8192, 4096])
  expect(draw).toHaveBeenCalledWith(bitmap, 0, 0)
  expect(encode).toHaveBeenCalledWith({
    type: `image/${format}`,
    quality: 0.95,
  })
  expect(result.type).toBe(`image/${format}`)
  expect(await result.text()).toBe('encoded')
  expect(close).toHaveBeenCalledTimes(1)
})
test('URL sources are fetched, with HTTP failures rejected before decoding', async () => {
  const fetch = mock(async (_url: string, _options: RequestInit) => new Response(source))
  install('fetch', fetch)
  await encodeArtwork('/artwork.jxl', 'png')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0][0]).toBe('/artwork.jxl')
  expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  fetch.mockImplementationOnce(async () => new Response('', {status: 404}))
  await expect(encodeArtwork('/missing.jxl', 'png')).rejects.toThrow('HTTP 404')
  expect(close).toHaveBeenCalledTimes(1)
})
test('encoding failure still releases the bitmap, and a silent PNG fallback is not mislabeled WebP', async () => {
  encode.mockRejectedValueOnce(new Error('Encoding failed'))
  await expect(encodeArtwork(source, 'png')).rejects.toThrow('Encoding failed')
  encode.mockResolvedValueOnce(new Blob(['png'], {type: 'image/png'}))
  await expect(encodeArtwork(source, 'webp')).rejects.toThrow('cannot encode WebP')
  expect(close).toHaveBeenCalledTimes(2)
})
test('a failed canvas context still releases the bitmap', async () => {
  install('OffscreenCanvas', class {
    getContext() {
      return null
    }
  })
  await expect(encodeArtwork(source, 'png')).rejects.toThrow('canvas is unavailable')
  expect(close).toHaveBeenCalledTimes(1)
})
test('copy requests permission in the gesture, before async image decoding, with a PNG promise', async () => {
  let data: Record<string, Promise<Blob>> = {}
  install('ClipboardItem', class {
    constructor(item: typeof data) {
      data = item
    }
  })
  const write = mock(async () => {})
  install('navigator', {clipboard: {write}})
  const copied = exportArtwork({
    source,
    title: 'Artwork',
  }, 'copy')
  expect(write).toHaveBeenCalledTimes(1)
  expect(encode).not.toHaveBeenCalled()
  expect(data['image/png']).toBeInstanceOf(Promise)
  const png = await data['image/png']
  expect(png.type).toBe('image/png')
  await copied
})
test('copy reports permission denial and unsupported contexts instead of pretending to succeed', async () => {
  install('ClipboardItem', class {})
  install('navigator', {clipboard: {write: async () => {
    throw new Error('Permission denied')
  }}})
  await expect(exportArtwork({
    source,
    title: 'Artwork',
  }, 'copy')).rejects.toThrow('Permission denied')
  install('isSecureContext', false)
  await expect(exportArtwork({
    source,
    title: 'Artwork',
  }, 'copy')).rejects.toThrow('HTTPS or localhost')
  await new Promise(resolve => setTimeout(resolve, 0))
})
test.each([
  ['A title', 'A title.png'],
  ['  ../A:B?*\n  ', '.._A_B___.png'],
  ['', 'Artwork.png'],
  [' ... ', 'Artwork.png'],
  ['CON', '_CON.png'],
  ['LPT1.jpg', '_LPT1.jpg.png'],
  ['Étoile 🖼', 'Étoile 🖼.png'],
])('a safe filename for %j', (title, name) => {
  expect(artworkFileName(title, 'png')).toBe(name)
})
test('long titles are bounded and use the requested extension', () => {
  expect(artworkFileName('x'.repeat(1000), 'webp')).toBe(`${'x'.repeat(120)}.webp`)
})
test('export exclusion survives UI remounts and always releases after a failed operation', async () => {
  const {useArtworkExport} = await import('../../src/lib/gallery/exportArtwork.ts')
  const {promise, reject} = Promise.withResolvers<void>()
  install('ClipboardItem', class {})
  install('navigator', {clipboard: {write: () => promise}})
  const writing = exportArtwork({
    source,
    title: 'Artwork',
  }, 'copy')
  expect(useArtworkExport.getState().busy).toBe(true)
  await expect(exportArtwork({
    source,
    title: 'Another artwork',
  }, 'copy')).rejects.toThrow('already being exported')
  reject(new Error('Clipboard denied'))
  await expect(writing).rejects.toThrow('Clipboard denied')
  expect(useArtworkExport.getState().busy).toBe(false)
  await new Promise(resolve => setTimeout(resolve, 0))
})
