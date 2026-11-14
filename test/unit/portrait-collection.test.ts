import {afterEach, describe, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import PortraitCollection from '#component/PortraitCollection'

import {useGallery} from '../../src/lib/gallery.ts'
import {climbApex} from '../../src/lib/gallery/climb.ts'
import {copyPortraitPng, encodePortraitImage, portraitFileName} from '../../src/lib/gallery/portraitExport.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'
import samplePortraits from './fixtures/portraits.ts'

const initial = {...useGallery.getInitialState()}
afterEach(() => {
  Object.assign(useGallery.getInitialState(), initial)
})
describe('PortraitCollection', () => {
  test('renders every portrait in the world and omits tooltips until interacted', () => {
    const html = renderToStaticMarkup(createElement(PortraitCollection))
    expect(html).toContain('data-testid="portrait-collection"')
    expect(html).toContain(`0 / ${initial.portraits.length}`)
    expect(html.match(/data-portrait=/gu)).toHaveLength(initial.portraits.length)
    expect(html).not.toContain('interestfor=')
    expect(html).not.toContain('data-testid="portrait-tooltip"')
    expect(html).not.toContain('His Unbothered Majesty')
  })
  test('shows an empty note when the world has no artworks', () => {
    Object.assign(useGallery.getInitialState(), {portraits: []})
    const html = renderToStaticMarkup(createElement(PortraitCollection))
    expect(html).toContain('No artworks in this world yet.')
    expect(html).not.toContain('data-portrait=')
  })
  test('renders rich tooltips with name, flavor text, author and year only for interacted works', () => {
    const portraits = [
      {
        ...samplePortraits[0],
        interacted: true,
      },
      {
        ...samplePortraits[1],
        interacted: true,
        year: 2026,
      },
      {
        ...samplePortraits[2],
        imported: true,
      },
    ]
    Object.assign(useGallery.getInitialState(), {portraits})
    const html = renderToStaticMarkup(createElement(PortraitCollection))
    expect(html).toContain('2 / 3')
    expect(html).toContain('data-imported="true"')
    expect(html.match(/data-testid="portrait-tooltip"/gu)).toHaveLength(2)
    expect(html.match(/\binterestfor="/gu)).toHaveLength(2)
    // First interacted work (no year -> Undated)
    const gooseTip = /data-portrait="goose"[^>]*\binterestfor="([^"]+)"/u.exec(html)?.[1]
    expect(gooseTip).toBeString()
    expect(html).toMatch(new RegExp(String.raw`<div id="${gooseTip}"[^>]*\bpopover="hint"[^>]*>.*?His Unbothered Majesty.*?foreign policy consists primarily of hissing.*?Cornelius van Honk.*?Undated`, 'u'))
    // Second interacted work (numeric year)
    const orangeTip = /data-portrait="orange"[^>]*\binterestfor="([^"]+)"/u.exec(html)?.[1]
    expect(orangeTip).toBeString()
    expect(html).toMatch(new RegExp(String.raw`<div id="${orangeTip}"[^>]*\bpopover="hint"[^>]*>.*?A Slightly Larger Tomorrow.*?misunderstood the brief.*?The Department of Lobbys.*?2026`, 'u'))
    // Untouched imported work has no tooltip
    expect(html).not.toContain('The Velvet Doge')
  })
})
describe('portrait export and clipboard', () => {
  test('builds safe filenames from portrait titles or ids', () => {
    expect(portraitFileName({
      id: 'goose',
      title: 'His Unbothered Majesty',
    }, 'png')).toBe('His Unbothered Majesty.png')
    expect(portraitFileName({
      id: 'bad',
      title: '  foo:bar/baz?*"<>|  ',
    }, 'webp')).toBe('foo bar baz.webp')
    expect(portraitFileName({
      id: 'fallback-id',
      title: '///...',
    }, 'png')).toBe('fallback-id.png')
  })
  test('keeps blobs that already match the requested PNG or WebP signature untouched', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
    const pngBlob = new Blob([pngBytes], {type: 'image/png'})
    expect(await encodePortraitImage(pngBlob, 'png')).toBe(pngBlob)
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    const webpBlob = new Blob([webpBytes], {type: 'image/webp'})
    expect(await encodePortraitImage(webpBlob, 'webp')).toBe(webpBlob)
  })
  test('re-encodes images into PNG or lossless WebP when conversion is needed', async () => {
    const sourceBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0])
    const sourceBlob = new Blob([sourceBytes], {type: 'image/jpeg'})
    const bitmapDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap')
    const canvasDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas')
    let closed = false
    const drawCalls: Array<unknown> = []
    const convertOptions: Array<unknown> = []
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: () => Promise.resolve({
        width: 32,
        height: 24,
        close: () => {
          closed = true
        },
      }),
    })
    Object.defineProperty(globalThis, 'OffscreenCanvas', {
      configurable: true,
      value: class {
        constructor(public width: number, public height: number) {}
        convertToBlob(options: {
          quality?: number
          type: string
        }) {
          convertOptions.push(options)
          return Promise.resolve(new Blob(['encoded'], {type: options.type}))
        }
        getContext() {
          return {
            drawImage: (...args: Array<unknown>) => drawCalls.push(args),
          }
        }
      },
    })
    try {
      const webp = await encodePortraitImage(sourceBlob, 'webp')
      expect(webp.type).toBe('image/webp')
      expect(closed).toBe(true)
      expect(drawCalls).toHaveLength(1)
      expect(convertOptions).toEqual([{
        type: 'image/webp',
        quality: 1,
      }])
      const png = await encodePortraitImage(sourceBlob, 'png')
      expect(png.type).toBe('image/png')
      expect(convertOptions[1]).toEqual({type: 'image/png'})
    } finally {
      if (bitmapDescriptor) {
        Object.defineProperty(globalThis, 'createImageBitmap', bitmapDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'createImageBitmap')
      }
      if (canvasDescriptor) {
        Object.defineProperty(globalThis, 'OffscreenCanvas', canvasDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'OffscreenCanvas')
      }
    }
  })
  test('copyPortraitPng passes an image/png ClipboardItem synchronously to navigator.clipboard.write', async () => {
    const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])], {type: 'image/png'})
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const itemDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
    const written: Array<Array<{items: Record<string, Blob | Promise<Blob>>}>> = []
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: class {
        constructor(public items: Record<string, Blob | Promise<Blob>>) {}
      },
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: (items: Array<{items: Record<string, Blob | Promise<Blob>>}>) => {
          written.push(items)
          return Promise.resolve()
        },
      },
    })
    try {
      await copyPortraitPng({source: pngBlob})
      expect(written).toHaveLength(1)
      expect(Object.keys(written[0][0].items)).toEqual(['image/png'])
      expect(await written[0][0].items['image/png']).toBe(pngBlob)
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      } else {
        Reflect.deleteProperty(navigator, 'clipboard')
      }
      if (itemDescriptor) {
        Object.defineProperty(globalThis, 'ClipboardItem', itemDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'ClipboardItem')
      }
    }
  })
})
describe('world floor selection', () => {
  test('reports single-floor worlds as upper and switches floors in the gallery', () => {
    expect(knottingham.isLowerFloor('arena', [0, 1.6, 0])).toBe(false)
    expect(sandbox.isLowerFloor('cell', [0, 1.6, 0])).toBe(false)
    expect(slopGallery.isLowerFloor('lobby', [0, 1.6, 0])).toBe(false)
    expect(slopGallery.isLowerFloor('oculus', [0, -9, -30])).toBe(true)
    expect(slopGallery.isLowerFloor('bastion', [climbApex.point[0] - 0.3, -1, climbApex.point[1]])).toBe(true)
    expect(slopGallery.isLowerFloor('bastion', [climbApex.point[0] + 0.3, -1, climbApex.point[1]])).toBe(false)
  })
})
