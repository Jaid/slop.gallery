import type {Portrait} from '../../src/lib/gallery/types.ts'

import {afterEach, beforeEach, expect, test} from 'bun:test'

import {artworkFileName, convertArtwork, copyArtwork, downloadArtwork} from '../../src/lib/gallery/artworkExport.ts'
import samplePortraits from './fixtures/portraits.ts'

const portrait = samplePortraits[0]
const named = (title: string, id = portrait.id): Portrait => ({
  ...portrait,
  id,
  title,
})
test.each([
  ['His Unbothered Majesty', 'png', 'his-unbothered-majesty.png'],
  ['Jean-François: L’Été!', 'webp', 'jean-francois-l-ete.webp'],
  ['!!!', 'png', 'goose.png'],
  ['', 'webp', 'goose.webp'],
] as const)('a download of “%s” as %s is named %s', (title, format, fileName) => {
  expect(artworkFileName(named(title), format)).toBe(fileName)
})
test('a long title’s slug stops at 80 characters and never ends on a dash', () => {
  const fileName = artworkFileName(named('word '.repeat(40).trim()), 'png')
  expect(fileName.length).toBeLessThanOrEqual(84)
  expect(fileName).not.toContain('-.png')
  expect(fileName).toEndWith('.png')
})
/** the browser parts an export touches, faked just far enough to watch it work */
class FakeCanvas {
  static drawn: unknown
  static encodedType = ''
  readonly height: number
  readonly width: number
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  convertToBlob({type}: {type: string}) {
    return Promise.resolve(new Blob(['pixels'], {type: FakeCanvas.encodedType || type}))
  }
  getContext() {
    return {
      drawImage: (image: unknown) => {
        FakeCanvas.drawn = image
      },
    }
  }
}
const bitmap = {
  width: 3,
  height: 2,
  closed: 0,
  close() {
    bitmap.closed++
  },
}
const replaced = ['createImageBitmap', 'OffscreenCanvas', 'ClipboardItem', 'document', 'fetch', 'navigator'] as const
const descriptors = new Map<string, PropertyDescriptor | undefined>
const replaceGlobal = (name: string, value: unknown) => {
  if (!descriptors.has(name)) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true,
  })
}
let clipboard: Array<unknown>
let downloaded: {
  click: () => void
  clicks: number
  download: string
  href: string
}
beforeEach(() => {
  bitmap.closed = 0
  FakeCanvas.drawn = undefined
  FakeCanvas.encodedType = ''
  clipboard = []
  downloaded = {
    download: '',
    href: '',
    clicks: 0,
    click() {
      downloaded.clicks++
    },
  }
  replaceGlobal('createImageBitmap', () => Promise.resolve(bitmap))
  replaceGlobal('OffscreenCanvas', FakeCanvas)
  replaceGlobal('ClipboardItem', class {
    constructor(readonly items: Record<string, unknown>) {}
  })
  replaceGlobal('document', {createElement: () => downloaded})
  replaceGlobal('fetch', () => Promise.resolve(new Response(new Blob(['jxl']))))
  replaceGlobal('navigator', {
    clipboard: {
      write: (items: Array<unknown>) => {
        clipboard = items
        return Promise.resolve()
      },
    },
  })
})
afterEach(() => {
  for (const name of replaced) {
    const descriptor = descriptors.get(name)
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }
  descriptors.clear()
})
test.each(['png', 'webp'] as const)('converting a work to %s re-encodes its decoded image at its own size and closes the bitmap', async format => {
  const blob = await convertArtwork(new Blob(['jxl']), format)
  expect(blob.type).toBe(`image/${format}`)
  expect(FakeCanvas.drawn).toBe(bitmap)
  expect(bitmap.closed).toBe(1)
})
test('converting a work the world serves by URL fetches it first', async () => {
  const blob = await convertArtwork('/art/goose.jxl', 'png')
  expect(blob.type).toBe('image/png')
  expect(bitmap.closed).toBe(1)
})
test('an encoder that answers in another format fails the export instead of misnaming it', async () => {
  FakeCanvas.encodedType = 'image/png'
  await expect(convertArtwork(new Blob(['jxl']), 'webp')).rejects.toThrow('could not be encoded as WebP')
  expect(bitmap.closed).toBe(1)
})
test('downloading a work saves the converted image under its slugged name', async () => {
  const fileName = await downloadArtwork(named('His Unbothered Majesty'), 'webp')
  expect(fileName).toBe('his-unbothered-majesty.webp')
  expect(downloaded.download).toBe(fileName)
  expect(downloaded.href).toStartWith('blob:')
  expect(downloaded.clicks).toBe(1)
})
test('copying a work puts its PNG on the clipboard', async () => {
  await copyArtwork(named('His Unbothered Majesty'))
  expect(clipboard).toHaveLength(1)
  const item = (clipboard[0] as {items: Record<string, unknown>}).items
  expect(Object.keys(item)).toEqual(['image/png'])
  const blob = await (item['image/png'] as Promise<Blob>)
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.type).toBe('image/png')
})
