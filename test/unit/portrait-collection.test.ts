import type {Portrait} from '../../src/lib/gallery/types.ts'

import {afterEach, describe, expect, mock, spyOn, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import ContextMenu from '#component/ContextMenu'
import PortraitCollection from '#component/PortraitCollection'
import PortraitTooltip from '#component/PortraitTooltip'

import {ArtworkThumbnails} from '../../src/lib/artworkThumbnails.ts'
import {copyPortrait, portraitFileName, portraitImage} from '../../src/lib/gallery/portraitExport.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import samplePortraits from './fixtures/portraits.ts'

const initial = {...useGallery.getInitialState()}
const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D])
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1A, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4C])
// A bare JXL codestream, like a default work’s image.
const jxl = new Uint8Array([0xFF, 0x0A, 0xFA, 0x1F, 0x19, 0])
/** The collection’s markup with the given works in it. Server rendering reads the store’s initial state. */
const render = (portraits: Array<Portrait>) => {
  Object.assign(useGallery.getInitialState(), {portraits})
  return renderToStaticMarkup(createElement(PortraitCollection))
}
/** The opening tag of the button of the work with the id. */
const itemOf = (html: string, id: string) => {
  const pattern = new RegExp(String.raw`<button\b[^>]*data-portrait="${id}"[^>]*>`, 'u')
  return pattern.exec(html)?.[0]
}
const tooltip = (year?: number) => renderToStaticMarkup(createElement(PortraitTooltip, {
  id: 'tooltip',
  portrait: {
    ...samplePortraits[0],
    year,
  },
}))
/** Object URLs that count up instead of the runtime’s, with what was revoked. */
const stubUrls = () => {
  let count = 0
  const create = spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:thumbnail-${++count}`)
  const revoke = spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return {
    create,
    revoke,
    restore: () => {
      create.mockRestore()
      revoke.mockRestore()
    },
  }
}
afterEach(() => {
  Object.assign(useGallery.getInitialState(), initial)
})
describe('portrait collection', () => {
  test('shows every work in the world as a button named after it, in the shape of its frame', () => {
    const html = render(initial.portraits)
    expect(initial.portraits.length).toBeGreaterThan(0)
    expect(html).toContain('data-testid="portrait-collection"')
    expect(html.match(/<li\b/gu)).toHaveLength(initial.portraits.length)
    for (const portrait of initial.portraits) {
      const item = itemOf(html, portrait.id)
      expect(item).toContain(`aria-label="${portrait.title}"`)
      expect(item).toContain('aria-haspopup="menu"')
      expect(item).toContain(`aspect-ratio:${portrait.width} / ${portrait.height}`)
    }
    // No menu is open before the player asks for one.
    expect(html).not.toContain('role="menu"')
  })
  test('includes works that arrived since, loose, reserved or imported', () => {
    const html = render([
      samplePortraits[0],
      {
        ...samplePortraits[1],
        id: 'loose',
        hung: false,
        wallId: undefined,
      },
      {
        ...samplePortraits[2],
        id: 'reserved',
        reserved: true,
      },
      {
        ...samplePortraits[3],
        id: 'arrival',
        imported: true,
        source: new Blob([webp], {type: 'image/webp'}),
      },
    ])
    for (const id of [samplePortraits[0].id, 'loose', 'reserved', 'arrival']) {
      expect(itemOf(html, id)).toBeString()
    }
  })
  test('only a work the player has interacted with has a tooltip, with its title, description, creator and year', () => {
    const known = {
      ...samplePortraits[0],
      interacted: true,
      year: 1924,
    }
    const untouched = samplePortraits[1]
    const html = render([known, untouched])
    const tooltipId = /\binterestfor="([^"]+)"/u.exec(itemOf(html, known.id)!)?.[1]
    expect(tooltipId).toBeString()
    expect(itemOf(html, known.id)).toContain('data-interacted="true"')
    const tooltips = html.match(/<div\b[^>]*popover="hint"[^>]*>.*?<\/div>/gu)!
    expect(tooltips).toHaveLength(1)
    expect(tooltips[0]).toContain(`id="${tooltipId}"`)
    for (const value of [known.title, known.description, known.creator, known.year]) {
      expect(tooltips[0]).toContain(String(value))
    }
    expect(itemOf(html, untouched.id)).not.toContain('interestfor')
    expect(itemOf(html, untouched.id)).toContain('data-interacted="false"')
    expect(html).not.toContain(untouched.description)
    expect(html).not.toContain(untouched.creator)
  })
  test('a tooltip tells a missing year apart from year zero', () => {
    expect(tooltip()).toContain('Undated')
    expect(tooltip(0)).toContain('<span>0</span>')
    expect(tooltip(0)).not.toContain('Undated')
  })
  test('a world without works says so instead of showing an empty grid', () => {
    const html = render([])
    expect(html).toContain('data-testid="portrait-collection"')
    expect(html).toContain('No works here yet.')
    expect(html).not.toContain('<ul')
    expect(html).not.toContain('<button')
  })
})
describe('context menu', () => {
  test('lists its items in order as menu items of a popover', () => {
    const html = renderToStaticMarkup(createElement(ContextMenu, {
      label: 'Image of “Goose”',
      x: 10,
      y: 20,
      onClose: () => {},
      items: [
        {
          id: 'first',
          label: 'First',
          icon: 'download',
          onSelect: () => {},
        },
        {
          id: 'second',
          label: 'Second',
          onSelect: () => {},
        },
      ],
    }))
    expect(html).toMatch(/^<div\b[^>]*\bpopover="auto"/u)
    expect(html).toMatch(/^<div\b[^>]*\brole="menu"/u)
    expect(html).toContain('aria-label="Image of “Goose”"')
    expect(html.match(/<button\b[^>]*role="menuitem"/gu)).toHaveLength(2)
    expect(html.indexOf('data-item="first"')).toBeLessThan(html.indexOf('data-item="second"'))
    expect(html.match(/<svg\b/gu)).toHaveLength(1)
  })
})
describe('portrait export', () => {
  test('names the file after the work, without what file names may not contain', () => {
    expect(portraitFileName({title: 'His Unbothered Majesty'}, 'png')).toBe('His Unbothered Majesty.png')
    expect(portraitFileName({title: 'Much Neon. Very Cosmic.'}, 'webp')).toBe('Much Neon. Very Cosmic.webp')
    expect(portraitFileName({title: String.raw`a/b\c: d? "e" <f> |g*`}, 'png')).toBe('a b c d e f g.png')
    expect(portraitFileName({title: ' line\nbreak\tand  spaces '}, 'png')).toBe('line break and spaces.png')
    expect(portraitFileName({title: '“Quoted” – ünïcödé 🦆'}, 'webp')).toBe('“Quoted” – ünïcödé 🦆.webp')
    for (const title of ['', '   ', '...', '?/:']) {
      expect(portraitFileName({title}, 'png')).toBe('Untitled.png')
    }
    // Cut by characters as they are read, never through one, and never ending in a dot or a space.
    expect(portraitFileName({title: '🦆'.repeat(500)}, 'png')).toBe(`${'🦆'.repeat(120)}.png`)
    expect(portraitFileName({title: '👩‍🎨'.repeat(500)}, 'png')).toBe(`${'👩‍🎨'.repeat(120)}.png`)
    expect(portraitFileName({title: `${'a'.repeat(119)} bcd`}, 'png')).toBe(`${'a'.repeat(119)}.png`)
  })
  test('hands out an image that already is of the format as it is, by its signature', async () => {
    const encode = mock(async (image: Blob) => image)
    const stored = new Blob([webp], {type: 'image/webp'})
    expect(await portraitImage({source: stored}, 'webp', encode)).toBe(stored)
    // A media type that lies about the bytes is set right.
    const mislabeled = new Blob([png], {type: 'application/octet-stream'})
    const image = await portraitImage({source: mislabeled}, 'png', encode)
    expect(image.type).toBe('image/png')
    expect(await image.bytes()).toEqual(png)
    expect(encode).not.toHaveBeenCalled()
  })
  test('encodes an image of another format anew, like a default work’s JXL or a WebP asked for as PNG', async () => {
    const encoded = new Blob([png], {type: 'image/png'})
    const encode = mock(async () => encoded)
    const work = new Blob([jxl], {type: 'image/jxl'})
    expect(await portraitImage({source: work}, 'png', encode)).toBe(encoded)
    expect(encode).toHaveBeenLastCalledWith(work)
    const stored = new Blob([webp], {type: 'image/webp'})
    expect(await portraitImage({source: stored}, 'png', encode)).toBe(encoded)
    expect(encode).toHaveBeenLastCalledWith(stored)
    // A JXL that claims to be a PNG is still encoded.
    const lying = new Blob([jxl], {type: 'image/png'})
    await portraitImage({source: lying}, 'png', encode)
    expect(encode).toHaveBeenLastCalledWith(lying)
    expect(encode).toHaveBeenCalledTimes(3)
  })
  test('loads the image of a work kept by its URL', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(png, {headers: {'Content-Type': 'image/png'}}))
    try {
      const image = await portraitImage({source: '/art/goose.png'}, 'png')
      expect(fetchSpy).toHaveBeenCalledWith('/art/goose.png')
      expect(await image.bytes()).toEqual(png)
      fetchSpy.mockResolvedValue(new Response('', {status: 404}))
      await expect(portraitImage({source: '/art/missing.png'}, 'png')).rejects.toThrow('The artwork could not be loaded.')
    } finally {
      fetchSpy.mockRestore()
    }
  })
  test('copies the image to the clipboard as a PNG, handing it over as a promise right away', async () => {
    const descriptors = {
      navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
      ClipboardItem: Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem'),
    }
    const written: Array<Array<{items: Record<string, Promise<Blob>>}>> = []
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          write: async (items: Array<{items: Record<string, Promise<Blob>>}>) => {
            written.push(items)
          },
        },
      },
    })
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: class {
        constructor(readonly items: Record<string, Promise<Blob>>) {}
      },
    })
    try {
      const stored = new Blob([png], {type: 'image/png'})
      await copyPortrait({source: stored})
      expect(written).toHaveLength(1)
      expect(written[0]).toHaveLength(1)
      const {items} = written[0][0]
      expect(Object.keys(items)).toEqual(['image/png'])
      expect(items['image/png']).toBeInstanceOf(Promise)
      expect(await items['image/png']).toBe(stored)
    } finally {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor)
        } else {
          Reflect.deleteProperty(globalThis, key)
        }
      }
    }
  })
})
describe('artwork thumbnails', () => {
  test('makes each artwork’s thumbnail once and has it ready from then on', async () => {
    const {create, restore} = stubUrls()
    try {
      const make = mock(async () => new Blob([webp], {type: 'image/webp'}))
      const thumbnails = new ArtworkThumbnails(make)
      const blob = new Blob([jxl])
      expect(thumbnails.peek('/art/goose.jxl')).toBeUndefined()
      const first = thumbnails.get('/art/goose.jxl')
      expect(thumbnails.get('/art/goose.jxl')).toBe(first)
      // Not ready before it is made.
      expect(thumbnails.peek('/art/goose.jxl')).toBeUndefined()
      expect(await first).toBe('blob:thumbnail-1')
      expect(thumbnails.peek('/art/goose.jxl')).toBe('blob:thumbnail-1')
      expect(await thumbnails.get(blob)).toBe('blob:thumbnail-2')
      expect(await thumbnails.get(blob)).toBe('blob:thumbnail-2')
      expect(make).toHaveBeenCalledTimes(2)
      expect(create).toHaveBeenCalledTimes(2)
      expect(thumbnails.size).toBe(2)
    } finally {
      restore()
    }
  })
  test('lets go of the thumbnails of works that left, also of one still being made', async () => {
    const {revoke, restore} = stubUrls()
    try {
      const pending = Promise.withResolvers<Blob>()
      const make = mock((source: Blob | string) => (source === '/slow.jxl' ? pending.promise : Promise.resolve(new Blob([webp]))))
      const thumbnails = new ArtworkThumbnails(make)
      const kept = await thumbnails.get('/kept.jxl')
      const gone = await thumbnails.get('/gone.jxl')
      const slow = thumbnails.get('/slow.jxl')
      thumbnails.retain(['/kept.jxl'])
      expect(thumbnails.size).toBe(1)
      expect(thumbnails.peek('/kept.jxl')).toBe(kept)
      expect(thumbnails.peek('/gone.jxl')).toBeUndefined()
      expect(revoke.mock.calls).toEqual([[gone]])
      // Made after all, with nobody left to show it.
      pending.resolve(new Blob([webp]))
      const late = await slow
      expect(revoke.mock.calls).toEqual([[gone], [late]])
      expect(thumbnails.peek('/slow.jxl')).toBeUndefined()
      // A work that comes back gets a new one.
      expect(await thumbnails.get('/gone.jxl')).not.toBe(gone)
      expect(make).toHaveBeenCalledTimes(4)
    } finally {
      restore()
    }
  })
  test('does not keep a failure, so the next call tries again', async () => {
    const {restore} = stubUrls()
    try {
      const make = mock(async () => new Blob([webp]))
      make.mockImplementationOnce(async () => {
        throw new Error('The artwork could not be loaded.')
      })
      const thumbnails = new ArtworkThumbnails(make)
      await expect(thumbnails.get('/art/goose.jxl')).rejects.toThrow('The artwork could not be loaded.')
      expect(thumbnails.size).toBe(0)
      expect(await thumbnails.get('/art/goose.jxl')).toBe('blob:thumbnail-1')
      expect(make).toHaveBeenCalledTimes(2)
    } finally {
      restore()
    }
  })
})
