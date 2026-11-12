import type {Browser, Page} from 'puppeteer-core'

import {afterAll, beforeAll, expect, test} from 'bun:test'

import puppeteer from 'puppeteer-core'

type Scenarios = typeof import('./browser/scenarios.ts')

// HTML-in-canvas only exists in a real browser: BROWSER_URL attaches to a running one’s DevTools, BROWSER launches an executable. Chromium 157 or newer.
// A browser on another machine reaches this server through RASTERIZE_ELEMENT_TEST_HOST.
const browserUrl = Bun.env.BROWSER_URL
const executable = Bun.env.BROWSER
const inBrowser = test.skipIf(!browserUrl && !executable)
// Our own font, made with fontTools’ FontBuilder: its only glyph, “W”, is a solid em square.
const boxFont = 'd09GMgABAAAAAAEoAAoAAAAAAowAAADfAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmAANAoYNgE2AiQDBgsGAAQgBX4HJhvtAcieB6bbJ5mr+EdsvFDMF0E83/+R3vdnkq4r5lRgW4FiwbKUsOb9IOWq28RQDNXQLMlQDmJeGHK4HkThja4ByTP/81V1eBxQgAHmHgYWBDgQG2hgkeaX68m8oHx7kR6VLruoauYWWlsgbxQbswAN9lZgoHCuBOfaCq0Fm38BCXADNIJYgPchna2TpWkCQfiW0b7K/rarJvz2DxCPaxaUAUJN0gcYpyYIhhYwSOl2uyBOcA1bRUt6R9y4BgyHHm9FraHTnx6vUcPUGdroeKo1UHzikwuCls/AlSm2fAQAAAA='
const opaque = (red: number, green: number, blue: number) => `${red},${green},${blue},255`
const empty = '0,0,0,0'
let browser: Browser | undefined
let page: Page | undefined
let server: ReturnType<typeof Bun.serve> | undefined
beforeAll(async () => {
  if (!browserUrl && !executable) {
    return
  }
  const build = await Bun.build({
    entrypoints: [`${import.meta.dir}/browser/entry.ts`],
    target: 'browser',
    format: 'esm',
  })
  const script = await build.outputs[0].text()
  server = Bun.serve({
    port: 0,
    hostname: '0.0.0.0',
    async fetch(request) {
      const url = new URL(request.url)
      await Bun.sleep(Number(url.searchParams.get('delay') ?? 0))
      const headers = {'cache-control': 'no-store'}
      if (url.pathname === '/') {
        return new Response('<!doctype html><meta charset="utf-8"><body><script type="module" src="/scenarios.js"></script>', {
          headers: {
            ...headers,
            'content-type': 'text/html',
          },
        })
      }
      if (url.pathname === '/scenarios.js') {
        return new Response(script, {
          headers: {
            ...headers,
            'content-type': 'text/javascript',
          },
        })
      }
      if (url.pathname === '/image.svg') {
        return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="#ff8800"/></svg>', {
          headers: {
            ...headers,
            'content-type': 'image/svg+xml',
          },
        })
      }
      if (url.pathname === '/box.woff2') {
        return new Response(Uint8Array.fromBase64(boxFont), {
          headers: {
            ...headers,
            'content-type': 'font/woff2',
          },
        })
      }
      return new Response('not found', {status: 404})
    },
  })
  browser = browserUrl ? await puppeteer.connect({
    browserURL: browserUrl,
    defaultViewport: null,
  }) : await puppeteer.launch({
    executablePath: executable,
    defaultViewport: null,
  })
  page = await browser.newPage()
})
afterAll(async () => {
  await page?.close()
  await (browserUrl ? browser?.disconnect() : browser?.close())
  await server?.stop(true)
})
/** Runs a scenario on a fresh page, which has to be the visible one: a hidden page is not painted. */
const run = async <Name extends keyof Scenarios>(name: Name) => {
  await page!.goto(`http://${Bun.env.RASTERIZE_ELEMENT_TEST_HOST ?? 'localhost'}:${server!.port}/`)
  await page!.bringToFront()
  await page!.waitForFunction('globalThis.scenarios !== undefined')
  return await page!.evaluate(scenario => (globalThis as unknown as {scenarios: Record<string, () => Promise<unknown>>}).scenarios[scenario](), name) as Awaited<ReturnType<Scenarios[Name]>>
}
inBrowser('elements land at their placements, scaled by the resolution, and everything is taken out of the document again', async () => {
  expect(await run('tiles')).toEqual({
    size: [800, 200],
    first: opaque(255, 0, 0),
    betweenTiles: empty,
    second: opaque(0, 255, 0),
    belowFirst: empty,
    connected: false,
    contentAttribute: null,
    elementsDetached: true,
    drawableAttributes: 0,
    bodyChildrenAdded: 0,
    leftovers: 0,
  })
})
inBrowser('a canvas without a given size takes the one of its placed elements', async () => {
  const result = await run('ownSize')
  expect(result.plain).toEqual([120, 40, opaque(255, 0, 0)])
  expect(result.scaled).toEqual([180, 60, opaque(255, 0, 0)])
  expect(result.widened).toEqual([240, 80, opaque(255, 0, 0)])
  expect(result.fractionalHeight).toBe(30)
  expect(result.fractionalWidthIsWholeAndWide).toBe(true)
  expect(result.offset).toEqual([150, 50, empty, opaque(255, 0, 0)])
})
inBrowser('percentages resolve against the logical size', async () => {
  expect(await run('percentages')).toEqual({
    inside: opaque(255, 0, 0),
    rightOf: empty,
    below: empty,
  })
})
inBrowser('a higher resolution rasterizes the element anew instead of stretching it', async () => {
  const {sizes, rasterized, stretched} = await run('rasterizedAtResolution')
  expect(sizes[1]).toBe(sizes[0] * 4)
  expect(rasterized).toBeLessThan(stretched * 0.6)
})
inBrowser('bleed draws what reaches beyond the border box and keeps the box where it was placed', async () => {
  expect(await run('bleed')).toEqual({
    clippedShadow: empty,
    clippedBox: opaque(255, 0, 0),
    bledShadow: opaque(0, 255, 0),
    bledBox: opaque(255, 0, 0),
    bledBoxCorner: opaque(255, 0, 0),
    bledBeyondShadow: empty,
  })
})
inBrowser('an image that is still loading is waited for', async () => {
  const {waited, pixel} = await run('lateImage')
  expect(waited).toBeGreaterThan(250)
  expect(pixel).toBe(opaque(255, 136, 0))
})
inBrowser('a broken image does not keep the rest from being painted', async () => {
  const {pixel} = await run('brokenImage')
  expect(pixel).toBe(opaque(0, 0, 255))
})
inBrowser('a web font that is still loading is waited for instead of painting its fallback', async () => {
  const {waited, covered} = await run('lateFont')
  expect(waited).toBeGreaterThan(250)
  expect(covered).toBeGreaterThan(0.95)
})
inBrowser('an element that is not rendered fails the painting instead of leaving a hole', async () => {
  const {message, leftovers, detached} = await run('notRendered')
  expect(message).toContain('1 of 2 elements have no paint record')
  expect(leftovers).toBe(0)
  expect(detached).toBe(true)
})
inBrowser('containers: hidden and transparent ones paint, unrendered ones and ones that move the canvas out of the viewport fail', async () => {
  const result = await run('containers')
  expect(result.plain).toBe('resolved')
  expect(result.invisible).toBe('resolved')
  expect(result.transparent).toBe('resolved')
  expect(result.scrolledAwayButFixed).toBe('resolved')
  expect(result.displayNone).toContain('no paint record')
  expect(result.movedAway).toContain('outside the viewport')
  expect(result.leftovers).toBe(0)
})
inBrowser('an abort rejects with its reason, before and while waiting, and cleans up', async () => {
  const {early, late, waited, leftovers, detached} = await run('abort')
  expect(early).toBe('Error: before')
  expect(late).toBe('Error: during')
  expect(waited).toBeLessThan(1000)
  expect(leftovers).toBe(0)
  expect(detached).toBe(true)
})
inBrowser('the page’s style sheets apply to the elements', async () => {
  expect(await run('pageStyles')).toEqual({
    size: [80, 30],
    child: opaque(255, 0, 0),
    parent: opaque(0, 255, 0),
  })
})
inBrowser('an element can be painted again and is taken from its parent', async () => {
  expect(await run('again')).toEqual({
    first: opaque(255, 0, 0),
    second: opaque(0, 255, 0),
    third: opaque(0, 0, 255),
    takenFromItsParent: true,
  })
})
inBrowser('many paintings at once do not mix up', async () => {
  expect(await run('manyAtOnce')).toEqual({
    wrong: 0,
    leftovers: 0,
  })
})
inBrowser('arranging adapts laid out elements before they are drawn', async () => {
  const result = await run('arranging')
  expect(result.overflowedBefore).toBe(true)
  expect(result.fitsAfter).toBe(true)
  expect(result.size).toEqual([100, 50])
  expect(result.blankAbove).toBe(1)
  expect(result.blankBelow).toBe(1)
  expect(result.blankMiddle).toBeLessThan(0.98)
})
inBrowser('a React node renders into an element of its own size and unmounts on disposal', async () => {
  expect(await run('reactNodes')).toEqual({
    size: [120, 40],
    child: opaque(255, 0, 0),
    parent: opaque(0, 255, 0),
    childrenBefore: 1,
    childrenAfter: 0,
  })
})
inBrowser('a watched painter reports repainted elements in time to draw them anew', async () => {
  const result = await run('watching')
  expect(result.before).toEqual([opaque(255, 0, 0), opaque(0, 255, 0)])
  expect(result.after).toEqual([opaque(255, 0, 0), opaque(0, 0, 255)])
  expect(result.repaints).toEqual([['second']])
  expect(result.unwatched).toBe(opaque(255, 0, 0))
  expect(result.size).toEqual([100, 50])
  expect(result.removed).toBe(true)
  expect(result.removedSizeOf).not.toBe('resolved')
})
inBrowser('disposal empties the canvas, detaches the elements, keeps their own attributes and ends the rasterizer', async () => {
  const result = await run('disposal')
  expect(result.canvasSize).toEqual([0, 0])
  expect(result.leftovers).toBe(0)
  expect(result.keptItsOwnAttribute).toBe(true)
  expect(result.detached).toBe(true)
  expect(result.afterDisposal).toContain('disposed')
  expect(result.invalid.every(message => message.startsWith('RangeError'))).toBe(true)
})
