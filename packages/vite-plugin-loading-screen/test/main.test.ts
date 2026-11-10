import type {Rolldown} from 'vite'

import {afterEach, beforeEach, expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import fs from 'fs-extra'
import {build, createServer} from 'vite'

import loadingScreenPlugin from '../src/main.ts'

type Options = Parameters<typeof loadingScreenPlugin>[0]

// The smallest PNG there is, a single transparent pixel.
const pixel = Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==')
const page = '<!doctype html><html><head><title>Fixture</title></head><body><script type="module" src="./main.js"></script></body></html>'
let root: string
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'loading-screen-'))
  await fs.outputFile(join(root, 'index.html'), page)
  await fs.outputFile(join(root, 'wallpaper.png'), pixel)
  await fs.outputFile(join(root, 'night.png'), pixel.toReversed())
  await fs.outputFile(join(root, 'main.js'), 'import wallpaper from "./wallpaper.png"\nimport night from "./night.png"\nconsole.log(wallpaper, night)')
})
afterEach(() => fs.remove(root))
const buildPage = async (options: Options, base = '/') => {
  const result = await build({
    root,
    base,
    configFile: false,
    logLevel: 'silent',
    plugins: [loadingScreenPlugin(options)],
    // Nothing gets inlined, so the wallpapers stay files.
    build: {assetsInlineLimit: 0},
  })
  if (Array.isArray(result) || 'close' in result) {
    throw new TypeError('Expected one completed build output.')
  }
  const assets = result.output.filter((output): output is Rolldown.OutputAsset => output.type === 'asset')
  const fileOf = (original: string) => assets.find(asset => asset.originalFileNames.includes(original))!.fileName
  return {
    html: await fs.readFile(join(root, 'dist/index.html'), 'utf8'),
    fileOf,
  }
}
/** What the page’s inline script makes of the screen when the page opens with the query. */
const runScript = (html: string, search: string) => {
  const script = /<script>(\{[\s\S]*?\n\})<\/script>/u.exec(html)?.[1]
  if (!script) {
    throw new Error('The page has no inline script.')
  }
  const texts = {
    h1: '',
    p: '',
  }
  const properties = new Map<string, string>
  const appended: Array<Record<string, unknown>> = []
  const element = {
    querySelector: (selector: 'h1' | 'p') => ({
      set textContent(value: string) {
        texts[selector] = value
      },
    }),
    style: {setProperty: (name: string, value: string) => properties.set(name, value)},
  }
  const document = {
    title: '',
    querySelector: (selector: string) => (selector === '#loading-screen' ? element : null),
    createElement: (tag: string) => ({tag}),
    head: {append: (node: Record<string, unknown>) => appended.push(node)},
  }
  const run = new Function('document', 'location', script) as (document: unknown, location: unknown) => void
  run(document, {search})
  return {
    title: document.title,
    heading: texts.h1,
    tagline: texts.p,
    wallpaper: properties.get('--wallpaper'),
    appended,
  }
}
const worlds = {
  day: {
    title: 'Day <World>',
    tagline: 'Bright & early',
    wallpaper: 'wallpaper.png',
  },
  night: {
    title: 'Night',
    tagline: 'Late',
    wallpaper: 'night.png',
  },
  void: {title: 'Void'},
}
/** Self-contained, as the page runs its source alone. */
const select = (search: string, parameter: string, known: ReadonlyArray<string>) => {
  const query = new URLSearchParams(search)
  const picked = query.get(parameter)
  return (picked && known.includes(picked) ? picked : (picked === 'lost' ? 'lost' : 'day')) as keyof typeof worlds
}
const selected = (): Options => ({
  screens: worlds,
  defaultScreen: 'day',
  select,
  selectorArguments: ['world', ['night', 'void']],
})
test('a single screen is all HTML and CSS, with its wallpaper preloaded', async () => {
  const {fileOf, html} = await buildPage({
    title: 'Slop <Gallery>',
    tagline: 'Good taste & questionable art',
    wallpaper: join(root, 'wallpaper.png'),
  })
  const wallpaper = `/${fileOf('wallpaper.png')}`
  expect(html).toContain(`<div id="loading-screen" aria-busy="true" style="--wallpaper: url(&quot;${wallpaper}&quot;)"><div><h1>Slop &lt;Gallery&gt;</h1><p>Good taste &amp; questionable art</p><span>Loading…</span></div></div>`)
  expect(html).toContain(`<link rel="preload" as="image" type="image/png" href="${wallpaper}" fetchpriority="high">`)
  expect(html).toContain('#loading-screen {')
  expect(html).toContain('font-family: system-ui, sans-serif;')
  expect(html).not.toContain('<script>')
  // The screen comes first in the body, before the app’s own elements.
  expect(html.indexOf('id="loading-screen"')).toBeLessThan(html.indexOf('</body>'))
  expect(html).toContain('<title>Fixture</title>')
})
test('a screen needs neither tagline nor wallpaper, and takes its own label and font', async () => {
  const {html} = await buildPage({
    title: 'Plain',
    label: 'Brewing…',
    fontFamily: 'main, serif',
  })
  expect(html).toContain('<div id="loading-screen" aria-busy="true"><div><h1>Plain</h1><p></p><span>Brewing…</span></div></div>')
  expect(html).toContain('font-family: main, serif;')
  expect(html).not.toContain('rel="preload" as="image"')
})
test('the base path leads to the wallpaper', async () => {
  const {fileOf, html} = await buildPage({
    title: 'Based',
    wallpaper: 'wallpaper.png',
  }, '/game/')
  expect(html).toContain(`href="/game/${fileOf('wallpaper.png')}"`)
})
test('several screens start with the default one and let the URL pick', async () => {
  const {fileOf, html} = await buildPage(selected())
  // The default screen’s texts are in the HTML, its wallpaper only comes with the script, which knows whether it is the one.
  expect(html).toContain('<div id="loading-screen" aria-busy="true"><div><h1>Day &lt;World&gt;</h1><p>Bright &amp; early</p><span>Loading…</span></div></div>')
  expect(html).not.toContain('rel="preload" as="image"')
  // Nothing a title holds can end the script early.
  expect(html).not.toContain('Day <World>')
  const day = runScript(html, '')
  expect(day).toEqual({
    title: 'Day <World>',
    heading: 'Day <World>',
    tagline: 'Bright & early',
    wallpaper: `url("/${fileOf('wallpaper.png')}")`,
    appended: [
      {
        tag: 'link',
        rel: 'preload',
        as: 'image',
        href: `/${fileOf('wallpaper.png')}`,
        fetchPriority: 'high',
        type: 'image/png',
      },
    ],
  })
  const night = runScript(html, '?world=night')
  expect(night.title).toBe('Night')
  expect(night.tagline).toBe('Late')
  expect(night.wallpaper).toBe(`url("/${fileOf('night.png')}")`)
  expect(fileOf('night.png')).not.toBe(fileOf('wallpaper.png'))
  expect(runScript(html, '?world=void')).toEqual({
    title: 'Void',
    heading: 'Void',
    tagline: '',
    wallpaper: undefined,
    appended: [],
  })
  // An ID without a screen falls back to the default.
  expect(runScript(html, '?world=lost').title).toBe('Day <World>')
})
test('a wallpaper no module imports fails the build', async () => {
  await fs.outputFile(join(root, 'main.js'), 'console.log(1)')
  expect(buildPage({
    title: 'Lost',
    wallpaper: 'wallpaper.png',
  })).rejects.toThrow('The build holds no wallpaper.png')
})
test('the development server shows the wallpaper’s file itself', async () => {
  const outside = await fs.mkdtemp(join(tmpdir(), 'loading-screen-outside-'))
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: {middlewareMode: true},
    plugins: [
      loadingScreenPlugin({
        title: 'Inside',
        wallpaper: join(root, 'wallpaper.png'),
      }),
    ],
  })
  const elsewhere = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    server: {middlewareMode: true},
    plugins: [
      loadingScreenPlugin({
        title: 'Outside',
        wallpaper: join(outside, 'far.jxl'),
      }),
    ],
  })
  try {
    expect(await server.transformIndexHtml('/', page)).toContain('<link rel="preload" as="image" type="image/png" href="/wallpaper.png" fetchpriority="high">')
    const html = await elsewhere.transformIndexHtml('/', page)
    expect(html).toContain(`type="image/jxl" href="/@fs/${join(outside, 'far.jxl').replaceAll('\\', '/')}"`)
  } finally {
    await server.close()
    await elsewhere.close()
    await fs.remove(outside)
  }
})
