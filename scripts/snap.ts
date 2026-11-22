import type {CameraView} from '#src/lib/diagnostics.ts'
import type {CameraBookmark, Vec3} from '#src/lib/gallery/types.ts'
import type {GalleryValues, LooseOptions} from './lib/headlessGallery.ts'
import type {ToolCall} from 'capture-page'

import {parseArgs} from 'node:util'

import capturePage from 'capture-page'
import {endWarmup, executeWebmcpTool, setWireframe, waitForLoadingItems} from 'capture-session/script'
import {isPlainObject} from 'es-toolkit'
import {join, relative} from 'forward-slash-path'
import fs from 'fs-extra'
import getFree from 'get-free'
import {lossyJxlOptions} from 'media-encoding'
import {Packr} from 'msgpackr'
import tinyhand from 'tinyhand'

import {anchorWorldReach, crossOriginArgs, degrees, galleryHelp, galleryOptions, normalizeOptions, parseNumbers, radians, repositoryRoot, resolveGallerySetup, resolveSettle, resolveSize, serveGallery, waitForFrames, waitForGallery, warnAboutDevServer, watchPage} from './lib/headlessGallery.ts'

type DownloadFrameResult = {
  dump: Record<string, unknown> | null
  height: number
  nonBlackFraction: number
  width: number
}

const snapHeight = 2160
/** Its neighbors are everything a camera in a room can see, so photos look the same as with every room, while the rest never loads. Tool calls into rooms out of reach fail, which --world_reach all lets through. */
const snapWorldReach = 'neighbors'
/** the default environment, so photos of the same view match */
const snapSeed = '0'
/** cjxl effort for photos, which are lossless by default: a 2160p photo encodes in about a second, while the shared effort 10 takes minutes */
const snapJxlEffort = '6'
const help = `Usage: bun scripts/snap.ts [options]

Takes a headless photo of a world and writes it to out/snap/<name>.jxl, next to out/snap/<name>.msgpack with the X dump of the same view.
Serves the build --target names, dist unless told otherwise, or starts a private Vite dev server with --target false, and a private headless browser through capture-page; never touches the visible browser.
By default the photo is a fresh WebGPU render, without DOM overlays. Use --text-overlays to include HTML measurement labels. Its camera is the player, flying: the room its eyes are in is the player’s.

Options:
${galleryHelp(snapHeight, {
  seed: snapSeed,
  without: ['frozen_time'],
  worldReach: snapWorldReach,
})}
  --frozen_time <seconds|false>
                          mirrors ?frozen_time, the engine time every animation stands still at, so photos of the same view match; false lets them run. Default: the bookmark’s, or 0
  --bookmark <id>         camera bookmark of the world (its rooms’ cameras.ts, like lobby-overview) that supplies the defaults of --position, --angle, --fov, the width-to-height ratio and --frozen_time
  --position <x,y,z>      where the player flies to, its eyes’ position in meters. Default: the bookmark’s, or the player spawn
  --angle <yaw,pitch[,roll]>
                          camera angle in degrees. Yaw 0 looks toward −z, positive pitch looks up. Default: the bookmark’s, or the player spawn
  --fov <degrees>         vertical field of view, exactly: it also mirrors ?fov, under which no mood widens the view. Default: the bookmark’s, or the game camera’s, which a mood of the room may widen like for any player, like the Corridor’s
  --jxl-distance <number> cjxl Butteraugli distance, 0 is lossless. Default: 0
  --jxl-effort <1–10>     cjxl effort; lossless 2160p takes about a second at 6 and minutes at 10. Default: ${snapJxlEffort}
  --settle <frames>       frames to render after flying there and again once everything has loaded. Default: 2, enough even with TRAA
  --wireframe <json>      input for the app’s set_wireframe WebMCP tool, sent after flying there, e.g. {"direction": "in", "position": [0, 0.5, -12], "radius": 6}
  --tools <json>          ordered WebMCP calls, e.g. [{"name":"spawn_sloperator","input":{"sight":"lobby_east_bench"}}]. Names may repeat. Calls run after loading, before the final settle; results go to stderr
  --text-overlays         photograph the canvas and its HTML text labels together at viewport resolution, hiding the rest of the page UI
  --name <name>           output file name without extension. Default: the next free number, starting at 1
  -h, --help              show this help

With --scale above 1, the photo renders at that many times the size and is downsampled to --width × --height with Lanczos in linear light, which needs ImageMagick’s magick on PATH.

Set BROWSER to a Chromium executable with WebGPU support.`
const snapRoot = join(repositoryRoot, 'out', 'snap')
const snapOptions = {
  ...galleryOptions,
  angle: {type: 'string'},
  bookmark: {type: 'string'},
  'jxl-distance': {
    type: 'string',
    default: '0',
  },
  'jxl-effort': {
    type: 'string',
    default: snapJxlEffort,
  },
  name: {type: 'string'},
  position: {type: 'string'},
  'text-overlays': {type: 'boolean'},
  wireframe: {type: 'string'},
  seed: {
    type: 'string',
    default: snapSeed,
  },
  settle: {
    type: 'string',
    default: '2',
  },
  world_reach: {
    type: 'string',
    default: snapWorldReach,
  },
} as const
const defaults = parseArgs({
  options: snapOptions,
  args: [],
}).values
export type SnapOptions = LooseOptions<SnapValues>
/** the options, or only the id of a camera bookmark to take the photo from */
export type SnapInput = SnapOptions | string
type SnapValues = typeof defaults & GalleryValues

export default async function snap(given: SnapInput, tools: ReadonlyArray<ToolCall> = []) {
  // A key would take options without a bookmark for one, so only text is the bookmark.
  const overrides = tinyhand((value: SnapInput): SnapOptions => (typeof value === 'string' ? {bookmark: value} : value), given)
  const options = {
    ...defaults,
    ...normalizeOptions<SnapValues>(overrides, snapOptions),
  }
  const setup = await resolveGallerySetup(options, snapHeight)
  warnAboutDevServer(setup)
  const settle = resolveSettle(options.settle)
  let bookmark: CameraBookmark | undefined
  if (options.bookmark !== undefined) {
    const {default: world} = await import(join(repositoryRoot, 'src', 'worlds', setup.world, 'index.ts')) as {default: {cameraBookmarks: () => Array<CameraBookmark>}}
    const cameraBookmarks = world.cameraBookmarks()
    bookmark = cameraBookmarks.find(entry => entry.id === options.bookmark)
    if (!bookmark) {
      throw new Error(`--bookmark must be one of the ${setup.world} camera bookmarks: ${cameraBookmarks.map(entry => entry.id).join(', ') || 'none'}.`)
    }
    setup.viewport = resolveSize(options, snapHeight, bookmark.ratio)
  }
  if (!setup.search.has('frozen_time')) {
    setup.search.set('frozen_time', String(bookmark?.frozenTime ?? 0))
  }
  const position = options.position === undefined ? bookmark?.position : parseNumbers(options.position, 'position', [3]) as Vec3
  const angle = options.angle === undefined ? bookmark && [degrees(bookmark.aim.yaw), degrees(bookmark.aim.pitch)] : parseNumbers(options.angle, 'angle', [2, 3])
  const requestedFov = setup.search.get('fov')
  const fov = requestedFov === null ? bookmark?.fov : parseNumbers(requestedFov, 'fov', [1])[0]
  if (fov !== undefined && (fov <= 0 || fov >= 180)) {
    throw new Error('--fov must be between 0 and 180 degrees.')
  }
  const jxlDistance = parseNumbers(options['jxl-distance'], 'jxl-distance', [1])[0]
  const effort = parseNumbers(options['jxl-effort'], 'jxl-effort', [1])[0]
  if (!Number.isInteger(effort) || effort < 1 || effort > 10) {
    throw new Error('--jxl-effort must be a whole number from 1 to 10.')
  }
  const wireframe = options.wireframe === undefined ? undefined : JSON.parse(options.wireframe) as unknown
  if (wireframe !== undefined && !isPlainObject(wireframe)) {
    throw new Error('--wireframe needs a JSON object of set_wireframe input.')
  }
  await anchorWorldReach(setup, position)
  await using server = await serveGallery(setup, {cacheDir: 'node_modules/.vite-snap'})
  console.log(`Loading ${server.url}`)
  let view: {
    fov: number | null
    position: Vec3
    rotation: Vec3
  } | undefined
  const withLabels = options['text-overlays']
  let screenDump: DownloadFrameResult['dump'] = null
  const capture = await capturePage(server.url, {
    browser: Bun.env.BROWSER,
    args: ['--enable-unsafe-webgpu', '--enable-features=WebMCP', ...crossOriginArgs],
    ...setup.viewport,
    body: false,
    capture: withLabels ? 'screenshot' : 'download',
    // Loading only gives up once nothing finishes for a while; Knottingham’s Knot materials alone take minutes.
    timeout: 1_800_000,
    wait: 'domcontentloaded',
    hook: async page => {
      watchPage(page)
      await waitForGallery(page)
      view = await page.evaluate((requested: Partial<CameraView>) => globalThis.slopGallery!.fly!(requested), {
        position,
        rotation: angle ? [radians(angle[1]), radians(angle[0]), radians(angle[2] ?? 0)] as Vec3 : undefined,
        fov,
      })
      if (wireframe) {
        await setWireframe(page, wireframe as Record<string, unknown>)
      }
      // A new view can bring artworks into view that still need decoding, and objects whose pipelines still compile.
      await waitForFrames(page, settle)
      await waitForLoadingItems(page)
      // All of it loaded at the warmup scale; the photo renders at the full size, after frames that build TRAA’s history there.
      const warmup = await endWarmup(page)
      if (warmup.warmed) {
        await waitForFrames(page, settle)
        await waitForLoadingItems(page)
      }
      // Repeated calls are meaningful: a measurement has several add_drawing calls, then a label.
      if (tools.length > 0) {
        for (const {name, input} of tools) {
          console.error(`${name}: ${await executeWebmcpTool(page, name, input)}`)
        }
        await waitForFrames(page, settle)
        await waitForLoadingItems(page)
      }
      await waitForFrames(page, settle)
      if (withLabels) {
        // Keep the page layout (and thus the canvas rectangle used to project the labels).
        await page.addStyleTag({content: 'body * { visibility: hidden !important } canvas, #gallery-text-overlay > div { visibility: visible !important }'})
        screenDump = await page.evaluate(() => globalThis.slopGallery!.dump?.() ?? null)
      }
    },
    // Dumps before rendering, like X: the frame shows the view the dump describes.
    toolCalls: withLabels ? [] : [{
      name: 'download_frame',
      input: {format: 'png'},
    }],
  })
  const frame = withLabels ? {
    ...setup.viewport,
    dump: screenDump,
    nonBlackFraction: undefined,
  } : capture.toolResults[0] as DownloadFrameResult
  if (frame.nonBlackFraction === 0) {
    throw new Error('The capture is completely black.')
  }
  await fs.mkdir(snapRoot, {recursive: true})
  const isTaken = async (candidate: string) => await fs.pathExists(join(snapRoot, `${candidate}.jxl`)) || fs.pathExists(join(snapRoot, `${candidate}.msgpack`))
  // Picked after the capture to keep the window for concurrent snaps short.
  const name = options.name ?? await getFree('', isTaken, {
    connector: '',
    consistent: true,
  })
  const output = join(snapRoot, `${name}.jxl`)
  const png = `${output}.png`
  await fs.writeFile(png, capture.buffer)
  const {width, height} = setup.viewport
  try {
    // With --scale the canvas renders more pixels than requested. They average down in linear light, so thin highlights and bright edges keep their brightness, with a Lanczos that is sharpened to make up for its softening.
    if (frame.width !== width || frame.height !== height) {
      await Bun.$`magick ${png} -depth 16 -colorspace RGB -filter LanczosSharp -distort Resize ${width}x${height}! -colorspace sRGB -depth 8 ${png}`.quiet()
    }
    await Bun.$`cjxl ${png} ${lossyJxlOptions(jxlDistance, effort)} ${output}`.quiet()
  } finally {
    await fs.rm(png, {force: true})
  }
  let dump: string | undefined
  if (frame.dump) {
    dump = join(snapRoot, `${name}.msgpack`)
    // Plain MessagePack maps without msgpackr records, so any decoder reads it.
    const messagePack = new Packr({useRecords: false})
    await fs.writeFile(dump, messagePack.pack(frame.dump))
  } else {
    console.warn('No X dump written: the player is not ready.')
  }
  return {
    /** the .msgpack X dump, unless the player was not ready */
    dump,
    height,
    output,
    /** the view the photo was taken from */
    view: view!,
    /** the size the canvas rendered at, larger than the photo with --scale above 1 */
    source: {
      width: frame.width,
      height: frame.height,
    },
    width,
  }
}

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...snapOptions,
      tools: {type: 'string'},
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    const {tools: json, ...options} = values
    const tools: unknown = json === undefined ? [] : JSON.parse(json)
    const isCall = (value: unknown): value is ToolCall => isPlainObject(value) && typeof value.name === 'string' && value.name.trim().length > 0 && isPlainObject(value.input)
    if (!Array.isArray(tools) || !tools.every(isCall)) {
      throw new Error('--tools needs a JSON array of {name, input} WebMCP calls.')
    }
    const {dump, height, output, source, view, width} = await snap(options, tools)
    const [pitch, yaw, roll] = view.rotation
    console.log(`Wrote ${relative(repositoryRoot, output)} (${width}×${height}${source.width === width && source.height === height ? '' : `, downsampled from ${source.width}×${source.height}`})${dump ? ' and its .msgpack X dump' : ''}`)
    console.log(`--position ${view.position.map(value => Math.round(value * 1000) / 1000).join(',')} --angle ${[yaw, pitch, roll].map(degrees).join(',')} --fov ${view.fov}`)
  }
}
