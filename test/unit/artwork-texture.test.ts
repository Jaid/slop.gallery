import {afterEach, beforeEach, expect, mock, test} from 'bun:test'

import loadArtworkTexture from '../../src/lib/loadArtworkTexture.ts'

const original = {
  fetch: globalThis.fetch,
  createImageBitmap: globalThis.createImageBitmap,
  document: globalThis.document,
}
let close = mock(() => {})
let draw = mock(() => {})
beforeEach(() => {
  close = mock(() => {})
  draw = mock(() => {})
  Object.assign(globalThis, {
    createImageBitmap: mock(async () => ({
      width: 32,
      height: 16,
      close,
    })),
    document: {
      createElement: () => {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: draw,
            getImageData: () => {
              throw new Error('Artwork must not read back pixels.')
            },
          }),
        }
        return canvas
      },
    },
  })
})
afterEach(() => Object.assign(globalThis, original))
test('retries a temporary server failure and creates an owned external-image texture', async () => {
  const fetch = mock(async () => new Response('image', {headers: {'Content-Type': 'image/jxl'}}))
  fetch.mockImplementationOnce(async () => new Response('', {status: 503}))
  Object.assign(globalThis, {fetch})
  const texture = await loadArtworkTexture('/overview.jxl', 0)
  try {
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(1)
    expect(texture.image.width).toBe(32)
    expect(texture.image.height).toBe(16)
    expect(texture.flipY).toBe(true)
    expect(texture.generateMipmaps).toBe(true)
  } finally {
    texture.dispose()
  }
  expect(close).toHaveBeenCalledTimes(1)
})
test('downscales large decoded artwork to the 4096 px texture limit', async () => {
  const bitmap = {
    width: 6000,
    height: 4000,
    close,
  }
  Object.assign(globalThis, {createImageBitmap: mock(async () => bitmap)})
  const texture = await loadArtworkTexture(new Blob(['image']))
  try {
    expect(texture.image.width).toBe(4096)
    expect(texture.image.height).toBe(2731)
    expect(draw).toHaveBeenCalledWith(bitmap, 0, 0, 4096, 2731)
  } finally {
    texture.dispose()
  }
  expect(close).toHaveBeenCalledTimes(1)
})
test('bounds failed URL retries and keeps the HTTP error actionable', async () => {
  const fetch = mock(async () => new Response('', {status: 404}))
  Object.assign(globalThis, {fetch})
  await expect(loadArtworkTexture('/missing.jxl', 0)).rejects.toThrow('Artwork image HTTP 404: /missing.jxl')
  expect(fetch).toHaveBeenCalledTimes(3)
  expect(close).not.toHaveBeenCalled()
})
test('recovers from a failed decode without leaking the successful bitmap', async () => {
  const decode = mock(async () => ({
    width: 32,
    height: 16,
    close,
  }))
  decode.mockImplementationOnce(async () => {
    throw new Error('Decode failed.')
  })
  Object.assign(globalThis, {
    fetch: mock(async () => new Response('image')),
    createImageBitmap: decode,
  })
  const texture = await loadArtworkTexture('/overview.jxl', 0)
  texture.dispose()
  expect(decode).toHaveBeenCalledTimes(2)
  expect(close).toHaveBeenCalledTimes(1)
})
test('closes bitmap resources on draw failure and does not retry immutable blobs', async () => {
  draw.mockImplementation(() => {
    throw new Error('Canvas draw failed.')
  })
  await expect(loadArtworkTexture(new Blob(['image']), 0)).rejects.toThrow('Canvas draw failed.')
  expect(draw).toHaveBeenCalledTimes(1)
  expect(close).toHaveBeenCalledTimes(1)
})
