import type {Vec3} from '#src/lib/gallery/types.ts'
import type World from '#src/worlds/base/World.ts'
import type {Browser, Page} from 'puppeteer-core'

import {basename, join, resolve, sep} from 'node:path'

import fs from 'fs-extra'
import {maximumSeed} from 'make-seed'
import {radiansToDegrees} from 'math'
import puppeteer from 'puppeteer-core'
import {createServer} from 'vite'

import {coerceEnvironmentSeed} from '#src/lib/environmentSeed.ts'
import {queryParameters} from '#src/lib/queryOverrides.ts'
import {parseStreamBudget} from '#src/lib/rendering/streamBudget.ts'
import {readWorldReach, worldReachModes} from '#src/worlds/base/WorldReach.ts'
import {readWorld, worldParameters} from '#src/worlds/index.ts'

export const repositoryRoot = resolve(import.meta.dir, '..', '..')
const dedicatedQueryOptionNames = new Set(['graphics', 'seed', 'stream_budget', 'test', 'warmup_scale', 'world_reach'])
/** rows of the drawing buffer while a page warms up, see --warmup_scale */
export const warmupRows = 360
// These have dedicated options with validation and defaults. A world’s own parameters open it, like --shots opens Knottingham and --item the Sandbox.
const queryOptionNames = [...new Set([...queryParameters.filter(key => !dedicatedQueryOptionNames.has(key)), ...Object.values(worldParameters).flat()])].toSorted()
/** the build scripts load the game from unless --target names another, or false for the dev server */
export const defaultTarget = 'dist'
/** the --seed of scripts that pick none of their own */
const defaultSeed = '1'
const queryOptions: Record<string, {type: 'string'}> = Object.fromEntries(queryOptionNames.map(key => [key, {type: 'string'}]))
/** Scripts pick their own default height, the ratio of width to height a missing side follows, 16:9 by default, and their default seed, and may leave out query options they set themselves. */
export const galleryHelp = (defaultHeight = 720, {ratio = 16 / 9, seed = defaultSeed, without = [], worldReach = 'all'}: {
  ratio?: number
  /** the --seed the script takes without one */
  seed?: string
  /** query options the script sets itself, which the help leaves out */
  without?: ReadonlyArray<string>
  /** the --world_reach the script takes without one */
  worldReach?: string
} = {}) => {
  const sides = ratio === 1 ? ['--height', '--width'] : (ratio === 16 / 9 ? ['--height × 16/9', '--width × 9/16'] : [`--height × ${ratio}`, `--width ÷ ${ratio}`])
  const listed = queryOptionNames.filter(key => !without.includes(key))
  return `  --target <dir|false>    the static build to load the game from, or false for a private Vite dev server, which can reload the page while it captures. Default: ${defaultTarget}
  --graphics <mode>       mirrors ?graphics (fast, heavy, cinematic, which is heavy with larger maps and more samples for non-realtime renders, or auto, which picks fast or heavy for the GPU). Default: heavy
  --seed <value>          mirrors ?seed: 0 selects the default environment; other numbers and text resolve to a seed from 1 to ${maximumSeed}. Default: ${seed}
  --test <true|false>     mirrors ?test, which gives the page its fly and teleport hooks and leaves the intro out. Default: true; false opens the page as players get it, without those hooks
  --stream_budget <ms|false>
                          mirrors ?stream_budget, the milliseconds a frame after loading may spend building objects. Default: false, which builds everything in the first frame, so the scene is complete about three times sooner than at the players’ 8 and, in cinematic graphics, whose every streaming frame renders the whole view, three to six times sooner than at 100
  --warmup_scale <scale|false>
                          mirrors ?warmup_scale, the renderer scale the page loads, compiles and streams everything in at until the script ends its warmup right before capturing, so those frames stay cheap and the full-size render targets don’t exist yet. Default: ${warmupRows} rows, ${warmupRows} divided by the height, unless the regular scale is smaller; false renders at the full size from the start
  --world_reach <room|neighbors|all>
                          mirrors ?world_reach, how much of the world mounts: only the room the page starts in, that room and its neighbors – the rooms a player can see into from anywhere in it – or every room. Default: ${worldReach}. snap.ts and film.ts reach out from the room their camera starts in, unless --room or --spawn names where to start; openings out of reach look into the void
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
    default: defaultSeed,
  },
  stream_budget: {type: 'string'},
  swiftshader: {type: 'boolean'},
  test: {type: 'string'},
  warmup_scale: {type: 'string'},
  world_reach: {type: 'string'},
  target: {
    type: 'string',
    default: defaultTarget,
  },
  width: {type: 'string'},
  height: {type: 'string'},
} as const
// Lists are for the options a script repeats, like film.ts’ --seed and --target.
export type GalleryValues = Partial<Record<string, ReadonlyArray<string> | boolean | string>> & {
  graphics: string
  height?: string
  seed: string
  stream_budget?: string
  swiftshader?: boolean
  target?: string
  test?: string
  warmup_scale?: string
  width?: string
  world_reach?: string
}
/** Options as a script’s default export takes them, all optional: an option the command line reads as text also takes a number or a boolean, like `fov: 70` for `--fov 70` or `paused: true` for `--paused true`, and in lists, like a repeated `--seed`. */
export type LooseOptions<Values> = {
  [Key in keyof Values]?: LooseValue<Values[Key]>
}
type LooseValue<Value> = Value extends boolean | undefined ? Value : Value extends ReadonlyArray<infer Item> ? ReadonlyArray<Item | boolean | number> : Value | boolean | number
const optionText = (value: unknown) => (typeof value === 'number' || typeof value === 'boolean' ? String(value) : value)
/** The options as the command line gives them: the numbers and booleans of options it reads as text turn into their text, in lists too, and undefined ones are left out, so they don’t override defaults spread before them. */
export const normalizeOptions = <Values>(options: LooseOptions<Values>, spec: Partial<Record<string, {type: 'boolean' | 'string'}>>) => {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined).map(([key, value]) => {
    if (spec[key]?.type === 'boolean') {
      return [key, value]
    }
    return [key, Array.isArray(value) ? value.map(optionText) : optionText(value)]
  })) as Partial<Values>
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
export const degrees = (radians: number) => Math.round(radiansToDegrees(radians) * 1000) / 1000
export {degreesToRadians as radians} from 'math'
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
/** Serves a local image or video under its own name so the page can import it over HTTP. Dispose it to stop serving. */
export const serveFile = (file: string) => {
  const name = `/${encodeURIComponent(basename(file))}`
  const headers = {'Access-Control-Allow-Origin': '*'}
  // Bun serves JXL as application/octet-stream, which the page refuses as an image.
  const type = /\.jxl$/iu.test(file) ? 'image/jxl' : undefined
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const {pathname} = new URL(request.url)
      return pathname === name ? new Response(Bun.file(file, {type}), {headers}) : new Response('Not found', {
        status: 404,
        headers,
      })
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}${name}`,
    [Symbol.asyncDispose]: () => server.stop(true),
  }
}
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
/**
 * Lets a limited `--world_reach` reach out from the room the player is going to fly to, with its eyes at `eye`, instead of the room the player spawns in: without `--room` or `--spawn`, it sets `--room` to the room whose fence holds the eye, so its spawn is where the page starts and its rooms are what it mounts. Returns the room it picked, if any.
 * Captures fly there only once the page has loaded, too late to change what it mounts; with every room in reach, there is nothing to pick.
 */
export const anchorWorldReach = async (setup: GallerySetup, eye: Vec3 | undefined) => {
  const {search} = setup
  if (!eye || readWorldReach(`?${search}`) === 'all' || search.has('room') || search.has('spawn')) {
    return
  }
  const {default: world} = await import(join(repositoryRoot, 'src', 'worlds', setup.world, 'index.ts')) as {default: World}
  const room = world.roomAt(eye)
  if (!room) {
    console.warn(`Warning: --world_reach ${readWorldReach(`?${search}`)} reaches out from the spawn, as the camera at ${eye.join(', ')} stands in none of the ${setup.world}’s rooms; --room names another room to reach out from.`)
    return
  }
  search.set('room', room.id)
  console.error(`--world_reach ${readWorldReach(`?${search}`)} reaches out from the camera’s room, --room ${room.id}`)
  return room.id
}
/** Warns on stderr when a capture runs against the dev server instead of a static build: Vite reloads the page whenever it optimizes newly found dependencies, as on a cold cache, and a reload after flying somewhere silently leaves the player at its spawn. */
export const warnAboutDevServer = (setup: GallerySetup) => {
  if (setup.target === undefined) {
    console.warn(`Warning: capturing from the Vite dev server, which can reload the page mid-capture and put the player back at its spawn; captures should load a static build: bun run build and leave out --target false, so ${defaultTarget} loads.`)
  }
}
/** Validates the shared gallery options before anything is started; a missing side of the viewport follows `ratio`, width divided by height. */
export const resolveGallerySetup = async (values: GalleryValues, defaultHeight = 720, ratio = 16 / 9) => {
  const given = values.target ?? defaultTarget
  const target = given === 'false' ? undefined : resolve(given)
  if (target !== undefined && !await fs.stat(join(target, 'index.html')).then(entry => entry.isFile(), () => false)) {
    throw new Error(`--target ${given} has no index.html. Build it first, e.g. bun run build, or load the dev server with --target false.`)
  }
  const test = values.test ?? 'true'
  if (test !== 'true' && test !== 'false') {
    throw new Error(`--test must be true or false, got “${test}”.`)
  }
  const search = new URLSearchParams({
    ai: 'false',
    test,
  })
  const seed = coerceEnvironmentSeed(values.seed)
  if (seed === undefined) {
    throw new Error('--seed expects a number or nonempty text.')
  }
  search.set('seed', String(seed))
  search.set('graphics', values.graphics)
  // ?test=true implies it already; it is explicit so captures keep it without the test hooks. Building everything in the first frame is fastest in every graphics mode: a budget spreads the building over frames that each render the whole view, over 200 of them in cinematic graphics, 0.35 s each at 2160p and 2.3 s at 8K. The warmup keeps that first frame small; even without it, it no longer lost the device on hive’s RX 9060 XT at 2160p or 8K.
  const streamBudget = values.stream_budget ?? 'false'
  if (parseStreamBudget(streamBudget) === undefined) {
    throw new Error(`--stream_budget must be milliseconds from 0 up or false, got “${streamBudget}”.`)
  }
  search.set('stream_budget', streamBudget)
  if (values.world_reach !== undefined) {
    if (!(worldReachModes as ReadonlyArray<string>).includes(values.world_reach)) {
      throw new Error(`--world_reach must be ${worldReachModes.join(', ')}, got “${values.world_reach}”.`)
    }
    search.set('world_reach', values.world_reach)
  }
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
    test: test === 'true',
    /** the world the page opens, which --room or a world’s own parameters choose */
    world: readWorld(`?${search}`),
    search,
    seed,
    viewport,
  }
}
/** Without these, headless Chrome on a machine without a GPU hands out a fallback adapter whose canvas can’t present, which loses the device on the first frame. ANGLE’s Vulkan backend additionally needs the surface extensions of a system Vulkan driver, without which the GPU process exits. */
/** Lets the page read cross-origin responses without CORS headers, so tool calls like add_portrait can bring in images from any host. The private headless browser only ever opens the gallery. */
export const crossOriginArgs = ['--disable-web-security']
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
/** Waits until the scene is ready and checks the debug hooks that captures rely on, the fly hook only where `fly` asks for it, as a page without `?test=true` has none. Fails early when the app shows its render error screen instead. */
export const waitForGallery = async (page: Page, {fly = true}: {fly?: boolean} = {}) => {
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
  if (fly && !await page.evaluate(() => Boolean(globalThis.slopGallery!.fly))) {
    throw new Error('This build has no slopGallery.fly() hook. Rebuild it from the current version.')
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
  /** further Chrome flags, like --disable-frame-rate-limit for uncapped frames */
  args?: ReadonlyArray<string>
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
      args: ['--enable-unsafe-webgpu', `--enable-features=${setup.swiftshader ? 'WebMCP,Vulkan' : 'WebMCP'}`, ...crossOriginArgs, ...setup.swiftshader ? swiftshaderArgs : [], ...options.args ?? []],
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
    await waitForGallery(page, {fly: setup.test})
    return {
      page,
      [Symbol.asyncDispose]: close,
    }
  } catch (error) {
    await close()
    throw error
  }
}
