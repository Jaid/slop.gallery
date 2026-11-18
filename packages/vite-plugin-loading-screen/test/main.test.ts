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
  await fs.outputFile(join(root, 'main.js'), 'import wallpaper from "./wallpaper.png"\nconsole.log(wallpaper)')
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
test('the HTML app entry and its wallpaper build under the base path', async () => {
  const {fileOf, html} = await buildPage({
    title: 'Based',
    wallpaper: 'wallpaper.png',
  }, '/game/')
  expect(html).not.toContain('<script type="module"')
  const entries = html.matchAll(/<template type="module"[^>]* src="\/game\/([^"]+)"/gu).toArray()
  expect(entries).toHaveLength(1)
  expect(await fs.readFile(join(root, 'dist', entries[0][1]), 'utf8')).toContain(fileOf('wallpaper.png'))
  expect(html).toContain(`href="/game/${fileOf('wallpaper.png')}"`)
})
test('the predicate decides separately for output chunks, classic scripts and inline metadata', async () => {
  const metadata = '<script type="application/ld+json">{"name":"Fixture"}</script>'
  await fs.outputFile(join(root, 'index.html'), page.replace('</head>', () => `${metadata}<script id="setup">window.label = "</template>&amp;"</script></head>`))
  const seen: Array<string> = []
  const {html} = await buildPage({
    title: 'Selective',
    deferScript: ({id, type = ''}) => {
      seen.push(id ?? type)
      return type !== 'application/ld+json'
    },
  })
  expect(seen.toSorted()).toEqual(['application/ld+json', 'module', 'setup'])
  expect(html).toContain(metadata)
  expect(html).not.toContain('<script id="setup"')
  expect(html).not.toContain('<script type="module"')
  expect(html).toContain('&lt;/template&gt;&amp;amp;')
  const kept = await buildPage({
    title: 'Native',
    deferScript: () => false,
  })
  expect(kept.html).not.toContain('data-loading-screen-script')
  expect(kept.html).toContain('<script type="module"')
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
    const insideHtml = await server.transformIndexHtml('/', page)
    expect(insideHtml).not.toContain('<script type="module" src=')
    expect(insideHtml).toContain('<link rel="preload" as="image" type="image/png" href="/wallpaper.png" fetchpriority="high">')
    const html = await elsewhere.transformIndexHtml('/', page)
    expect(html).toContain(`type="image/jxl" href="/@fs/${join(outside, 'far.jxl').replaceAll('\\', '/')}"`)
  } finally {
    await server.close()
    await elsewhere.close()
    await fs.remove(outside)
  }
})
