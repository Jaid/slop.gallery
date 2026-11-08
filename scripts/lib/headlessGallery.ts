import type {Browser, Page} from 'puppeteer-core'

import {join, resolve, sep} from 'node:path'

import fs from 'fs-extra'
import puppeteer from 'puppeteer-core'
import {createServer} from 'vite'

import {maximumSeed, parseSeed} from '#src/lib/environmentSeed.ts'
import {queryParameters} from '#src/lib/queryOverrides.ts'
import {parseStreamBudget} from '#src/lib/rendering/streamBudget.ts'
import {readWorld, worldParameters} from '#src/worlds/index.ts'

export const repositoryRoot = resolve(import.meta.dir, '..', '..')
const dedicatedQueryOptionNames = new Set(['graphics', 'seed', 'stream_budget', 'warmup_scale'])
/** rows of the drawing buffer while a page warms up, see --warmup_scale */
export const warmupRows = 360
// These have dedicated options with validation and defaults. A world’s own parameters open it, like --shots opens Knottingham and --item the Sandbox.
const queryOptionNames = [...new Set([...queryParameters.filter(key => !dedicatedQueryOptionNames.has(key)), ...Object.values(worldParameters).flat()])].toSorted()
const queryOptions: Record<string, {type: 'string'}> = Object.fromEntries(queryOptionNames.map(key => [key, {type: 'string'}]))
/** Scripts pick their own default height and the ratio of width to height a missing side follows, 16:9 by default, and may leave out query options they set themselves. */
export const galleryHelp = (defaultHeight = 720, {ratio = 16 / 9, without = []}: {
  ratio?: number
  /** query options the script sets itself, which the help leaves out */
  without?: ReadonlyArray<string>
} = {}) => {
  const sides = ratio === 1 ? ['--height', '--width'] : (ratio === 16 / 9 ? ['--height × 16/9', '--width × 9/16'] : [`--height × ${ratio}`, `--width ÷ ${ratio}`])
  const listed = queryOptionNames.filter(key => !without.includes(key))
  return `  --target <dir>          use this static build (e.g. dist) instead of the dev server, which suits captures better: the dev server can reload the page while it captures
  --graphics <mode>       mirrors ?graphics (fast, heavy, cinematic, which is heavy with larger maps and more samples for non-realtime renders, or auto, which picks fast or heavy for the GPU). Default: heavy
  --seed <number>         mirrors ?seed, the environment seed (0–${maximumSeed}) that decides random details like the potted plants. Default: 1
  --stream_budget <ms|false>
                          mirrors ?stream_budget, the milliseconds a frame after loading may spend building objects. Default: false, which builds everything in the first frame, so the scene is complete about three times sooner than at the players’ 8 and, in cinematic graphics, whose every streaming frame renders the whole view, three to six times sooner than at 100
  --warmup_scale <scale|false>
                          mirrors ?warmup_scale, the renderer scale the page loads, compiles and streams everything in at until the script ends its warmup right before capturing, so those frames stay cheap and the full-size render targets don’t exist yet. Default: ${warmupRows} rows, ${warmupRows} divided by the height, unless the regular scale is smaller; false renders at the full size from the start
  --swiftshader           renders on Chrome’s software Vulkan instead of a GPU, for machines without one like CI runners, which also need a system Vulkan driver like Mesa’s (mesa-vulkan-drivers on Ubuntu); slow, but enough to load and analyze the scene
  --width <pixels>        render width. Default: ${sides[0]}, or ${Math.round(defaultHeight * ratio)}
  --height <pixels>       render height. Default: ${sides[1]}, or ${defaultHeight}
  --<parameter> <value>   mirrors ?<parameter>=<value> for every other URL query parameter the app reads, e.g. --show_wireframe true or --anti_aliasing false:
                          ${listed.join(', ')}`
}
export const galleryOptions = {
  ...queryOptions,
  graphics: {
    type: 'string',
    default: 'heavy',
  },
  seed: {
    type: 'string',
    default: '1',
  },
  stream_budget: {type: 'string'},
  swiftshader: {type: 'boolean'},
  warmup_scale: {type: 'string'},
  target: {type: 'string'},
  width: {type: 'string'},
  height: {type: 'string'},
} as const
export type GalleryValues = Partial<Record<string, boolean | string>> & {
  graphics: string
  height?: string
  seed: string
  stream_budget?: string
  swiftshader?: boolean
  target?: string
  warmup_scale?: string
  width?: string
}
export type GallerySetup = Awaited<ReturnType<typeof resolveGallerySetup>>
export const parseNumbers = (value: string, name: string, lengths: Array<number>) => {
  const numbers = value.split(',').map(part => Number(part.trim()))
  if (!lengths.includes(numbers.length) || numbers.some(number => !Number.isFinite(number))) {
    throw new Error(`--${name} expects ${lengths.join(' or ')} comma-separated numbers, got “${value}”.`)
  }
  return numbers
}
const parseSize = (value: string | undefined, name: string) => {
  if (value === undefined) {
    return
  }
  const size = Number(value)
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error(`--${name} expects a positive whole number of pixels, got “${value}”.`)
  }
  return size
}
/** A missing side follows `ratio` (width divided by height); without either, the default height. */
export const resolveSize = (values: Pick<GalleryValues, 'height' | 'width'>, defaultHeight: number, ratio = 16 / 9) => {
  const width = parseSize(values.width, 'width')
  const height = parseSize(values.height, 'height')
  if (width === undefined && height === undefined) {
    return {
      width: Math.round(defaultHeight * ratio),
      height: defaultHeight,
    }
  }
  return {
    width: width ?? Math.round(height! * ratio),
    height: height ?? Math.round(width! / ratio),
  }
}
export const resolveSettle = (value: string) => {
  const [frames] = parseNumbers(value, 'settle', [1])
  if (!Number.isSafeInteger(frames) || frames < 0) {
    throw new Error(`--settle expects a whole number of frames, got “${value}”.`)
  }
  return frames
}
export const degrees = (radians: number) => Math.round(radians * 180 / Math.PI * 1000) / 1000
export const radians = (value: number) => value * Math.PI / 180
export const timestamp = () => {
  const now = new Date
  return now.toISOString().replaceAll(/[.:]/gu, '-').replace(/-\d{3}Z$/u, '')
}
export const waitForFrames = (page: Page, count: number) => page.evaluate(async frames => {
  for (let index = 0; index < frames; index++) {
    await new Promise(requestAnimationFrame)
  }
}, count)
const serveStatic = (root: string) => Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    const {pathname: encodedPathname} = new URL(request.url)
    const pathname = decodeURIComponent(encodedPathname)
    const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`)
    if (file !== root && !file.startsWith(root + sep)) {
      return new Response('Forbidden', {status: 403})
    }
    const isFile = await fs.stat(file).then(entry => entry.isFile(), () => false)
    return isFile ? new Response(Bun.file(file)) : new Response('Not found', {status: 404})
  },
})
/** The --warmup_scale to open the page with, or undefined for none: `false`, or a default that would not render fewer rows than the regular `scale`. */
const resolveWarmupScale = (value: string | undefined, height: number, scale: number) => {
  if (value === 'false') {
    return
  }
  if (value === undefined) {
    const warmupScale = Math.round(warmupRows / height * 10_000) / 10_000
    return warmupScale < scale ? warmupScale : undefined
  }
  const warmupScale = Number(value)
  if (!(Number.isFinite(warmupScale) && warmupScale > 0)) {
    throw new Error(`--warmup_scale must be a positive scale or false, got “${value}”.`)
  }
  return warmupScale
}
/** Warns on stderr when a capture runs against the dev server instead of a static build: Vite reloads the page whenever it optimizes newly found dependencies, as on a cold cache, and a reload after posing silently leaves the camera at the player spawn. */
export const warnAboutDevServer = (setup: GallerySetup) => {
  if (setup.target === undefined) {
    console.warn('Warning: capturing from the Vite dev server, which can reload the page mid-capture and lose the pose; captures should target a static build: bun run build, then --target dist.')
  }
}
/** Validates the shared gallery options before anything is started; a missing side of the viewport follows `ratio`, width divided by height. */
export const resolveGallerySetup = async (values: GalleryValues, defaultHeight = 720, ratio = 16 / 9) => {
  const target = values.target === undefined ? undefined : resolve(values.target)
  if (target !== undefined && !await fs.stat(join(target, 'index.html')).then(entry => entry.isFile(), () => false)) {
    throw new Error(`--target ${values.target} has no index.html. Build it first, e.g. bun run build.`)
  }
  const search = new URLSearchParams({
    ai: 'false',
    test: 'true',
  })
  const seed = parseSeed(values.seed)
  if (seed === undefined) {
    throw new Error(`--seed expects a whole number between 0 and ${maximumSeed}, got “${values.seed}”.`)
  }
  search.set('seed', String(seed))
  search.set('graphics', values.graphics)
  // ?test=true implies it already; it is explicit so captures keep it without the test hooks. Building everything in the first frame is fastest in every graphics mode: a budget spreads the building over frames that each render the whole view, over 200 of them in cinematic graphics, 0.35 s each at 2160p and 2.3 s at 8K. The warmup keeps that first frame small; even without it, it no longer lost the device on hive’s RX 9060 XT at 2160p or 8K.
  const streamBudget = values.stream_budget ?? 'false'
  if (parseStreamBudget(streamBudget) === undefined) {
    throw new Error(`--stream_budget must be milliseconds from 0 up or false, got “${streamBudget}”.`)
  }
  search.set('stream_budget', streamBudget)
  for (const key of queryOptionNames) {
    const value = values[key]
    if (typeof value === 'string') {
      search.set(key, value)
    }
  }
  const viewport = resolveSize(values, defaultHeight, ratio)
  const warmupScale = resolveWarmupScale(values.warmup_scale, viewport.height, Number(search.get('scale') ?? 1))
  if (warmupScale !== undefined) {
    search.set('warmup_scale', String(warmupScale))
  }
  return {
    swiftshader: values.swiftshader === true,
    target,
    /** the world the page opens, which --room or a world’s own parameters choose */
    world: readWorld(`?${search}`),
    search,
    seed,
    viewport,
  }
}
/** Without these, headless Chrome on a machine without a GPU hands out a fallback adapter whose canvas can’t present, which loses the device on the first frame. ANGLE’s Vulkan backend additionally needs the surface extensions of a system Vulkan driver, without which the GPU process exits. */
const swiftshaderArgs = ['--use-angle=vulkan', '--use-vulkan=swiftshader', '--enable-unsafe-swiftshader']
/** Starts a private Vite dev server, or serves the static target, and resolves with the page URL. Dispose it to stop the server. */
export const serveGallery = async (setup: GallerySetup, options: {
  /** Vite cache directory; a running dev server may share the default cache, and concurrent dependency optimization would invalidate each other’s chunks */
  cacheDir: string
}) => {
  const {target, search} = setup
  if (target !== undefined) {
    const staticServer = serveStatic(target)
    return {
      url: `http://127.0.0.1:${staticServer.port}/?${search}`,
      [Symbol.asyncDispose]: () => staticServer.stop(true),
    }
  }
  const server = await createServer({
    root: repositoryRoot,
    mode: 'development',
    // Bun loads the config like `bun run vite` does; Vite’s own bundling loader fails on the world catalog’s JXL import.
    configLoader: 'native',
    logLevel: 'error',
    cacheDir: options.cacheDir,
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
      // Source edits must not reload the page during a capture. HMR itself stays on: Vite needs it to reload the page after discovering and optimizing new dependencies.
      watch: null,
    },
  })
  try {
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      throw new Error('Vite did not expose a local TCP port.')
    }
    return {
      url: `http://127.0.0.1:${address.port}/?${search}`,
      [Symbol.asyncDispose]: () => server.close(),
    }
  } catch (error) {
    await server.close()
    throw error
  }
}
/** Reports page errors and closes the browser when the tab crashes, so pending waits reject instead of hanging. */
export const watchPage = (page: Page) => {
  page.on('pageerror', error => console.error(`Page error: ${String(error)}`))
  // WebGPU validation errors only reach the console, and a failed pass silently leaves its target stale.
  page.on('console', message => {
    if (message.type() === 'error') {
      console.error(`Console error: ${message.text()}`)
    }
  })
  page.on('error', crash => {
    console.error(`Page crashed: ${String(crash)}`)
    void page.browser().close().catch((closeError: unknown) => console.error(`Closing the browser after the crash failed: ${String(closeError)}`))
  })
}
/** Waits until the scene is ready and checks the debug hooks that captures rely on. Fails early when the app shows its render error screen instead. */
export const waitForGallery = async (page: Page) => {
  const outcome = await page.waitForFunction(() => {
    // RenderError replaces the scene when WebGPU is missing or rendering threw, e.g. because no adapter could be created; ready would never come.
    const renderError = document.querySelector('[data-testid="render-error"]')
    if (renderError) {
      return {error: renderError.querySelector('h2')?.textContent ?? 'unknown'}
    }
    return Boolean(globalThis.slopGallery?.snapshot?.().ready && globalThis.slopGallery.captureFrame) && {}
  }, {timeout: 300_000})
  const {error} = await outcome.jsonValue() as {error?: string}
  if (error !== undefined) {
    throw new Error(`The gallery showed its render error screen (“${error}”). The console errors above name the cause.`)
  }
  if (!await page.evaluate(() => Boolean(globalThis.slopGallery!.pose))) {
    throw new Error('This build has no slopGallery.pose() hook. Rebuild it from a version that includes scripts/snap.ts.')
  }
  if (!await page.evaluate(() => globalThis.slopGallery!.snapshot!().webGPU)) {
    throw new Error('The browser fell back to WebGL. Captures need native WebGPU.')
  }
}
/** a function Puppeteer serializes into the page, which runs it before any of the page’s own scripts, alone or with the arguments that follow it, which travel as JSON */
export type InitScript = (() => void) | readonly [script: (...args: Array<never>) => void, ...args: Array<unknown>]
/**
 * Starts the gallery server and a private headless browser, then waits until the scene is ready.
 * Never touches the visible browser. Dispose the result to stop everything again.
 */
export const openHeadlessGallery = async (setup: GallerySetup, options: {
  /** Vite cache directory, see serveGallery */
  cacheDir: string
  /** run in the page in order before any of its own scripts, like the virtual clock of capture-session/script */
  initScripts?: ReadonlyArray<InitScript>
}) => {
  const server = await serveGallery(setup, options)
  let browser: Browser | undefined
  const close = async () => {
    try {
      await browser?.close()
    } finally {
      await server[Symbol.asyncDispose]()
    }
  }
  try {
    browser = await puppeteer.launch({
      executablePath: Bun.env.BROWSER,
      headless: true,
      protocolTimeout: 600_000,
      // Frames leave the page as raw uploads of tens of megabytes. With network tracking, Chrome echoes every upload body through
      // the DevTools protocol, which slows film.ts down about 15× at 2160p and can exceed Bun’s WebSocket message limit.
      networkEnabled: false,
      defaultViewport: {
        ...setup.viewport,
        deviceScaleFactor: 1,
      },
      // WebMCP lets scripts call the app’s own tools, see callWebmcpTool from capture-session/script. Chrome only keeps the last --enable-features.
      args: ['--enable-unsafe-webgpu', `--enable-features=${setup.swiftshader ? 'WebMCP,Vulkan' : 'WebMCP'}`, ...setup.swiftshader ? swiftshaderArgs : []],
    })
    const page = await browser.newPage()
    watchPage(page)
    for (const initScript of options.initScripts ?? []) {
      const [script, ...args] = typeof initScript === 'function' ? [initScript] : initScript
      await page.evaluateOnNewDocument(script as (...args: Array<unknown>) => void, ...args)
    }
    // Progress goes to stderr, so a script’s stdout stays its result.
    console.error(`Loading ${server.url}`)
    await page.goto(server.url, {
      waitUntil: 'domcontentloaded',
      timeout: 300_000,
    })
    await waitForGallery(page)
    return {
      page,
      [Symbol.asyncDispose]: close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
