import type {CameraPose} from '#src/lib/diagnostics.ts'
import type {CameraBookmark, Vec3} from '#src/lib/gallery/types.ts'

import {join, relative} from 'node:path'
import {parseArgs} from 'node:util'

import capturePage from 'capture-page'
import {endWarmup, setWireframe, waitForLoadingItems} from 'capture-session/script'
import fs from 'fs-extra'
import getFree from 'get-free'
import {jxlEffort, lossyJxlOptions} from 'knot-materials/scripts/lib/encodeJxl.ts'
import {Packr} from 'msgpackr'

import {degrees, galleryHelp, galleryOptions, parseNumbers, radians, repositoryRoot, resolveGallerySetup, resolveSettle, resolveSize, serveGallery, waitForFrames, waitForGallery, warnAboutDevServer, watchPage} from './lib/headlessGallery.ts'

type DownloadFrameResult = {
  dump: Record<string, unknown> | null
  height: number
  nonBlackFraction: number
  width: number
}

const snapHeight = 1080
const help = `Usage: bun scripts/snap.ts [options]

Takes a headless photo of a world and writes it to out/snap/<name>.jxl, next to out/snap/<name>.msgpack with the X dump of the same view.
Starts a private Vite dev server (or serves --target) and a private headless browser through capture-page; never touches the visible browser.
The photo is a fresh WebGPU render of the scene, so menus and other DOM overlays are not in it.

Options:
${galleryHelp(snapHeight)}
  --bookmark <id>         camera bookmark of the world (its rooms’ cameras.ts, like lobby-overview) that supplies the defaults of --position, --angle, --fov, the width-to-height ratio and --frozen_time
  --position <x,y,z>      camera (eye) position in meters. Default: the bookmark’s, or the player spawn
  --angle <yaw,pitch[,roll]>
                          camera angle in degrees. Yaw 0 looks toward −z, positive pitch looks up. Default: the bookmark’s, or the player spawn
  --fov <degrees>         vertical field of view. Default: the bookmark’s, or the game camera’s
  --jxl-distance <number> cjxl Butteraugli distance, 0 is lossless. Default: 1
  --jxl-effort <1–10>     cjxl effort; lossless 2160p takes about a second at 6 and minutes at 10. Default: ${jxlEffort}
  --settle <frames>       frames to render after posing and again once everything has loaded. Default: 2, enough even with TRAA
  --wireframe <json>      input for the app’s set_wireframe WebMCP tool, sent after posing, e.g. {"direction": "in", "position": [0, 0.5, -12], "radius": 6}
  --name <name>           output file name without extension. Default: the next free number, starting at 1
  -h, --help              show this help

With --scale above 1, the photo renders at that many times the size and is downsampled to --width × --height with Lanczos in linear light, which needs ImageMagick’s magick on PATH.

Set BROWSER to a Chromium executable with WebGPU support.`
const snapRoot = join(repositoryRoot, 'out', 'snap')
const snapOptions = {
  ...galleryOptions,
  angle: {type: 'string'},
  bookmark: {type: 'string'},
  fov: {type: 'string'},
  'jxl-distance': {
    type: 'string',
    default: '1',
  },
  'jxl-effort': {
    type: 'string',
    default: String(jxlEffort),
  },
  name: {type: 'string'},
  position: {type: 'string'},
  wireframe: {type: 'string'},
  settle: {
    type: 'string',
    default: '2',
  },
} as const

/** the command line options without --help, as parsed strings */
export type SnapOptions = ReturnType<typeof parseArgs<{options: typeof snapOptions}>>['values']

const main = async (options: SnapOptions) => {
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
    if (bookmark.frozenTime !== undefined && !setup.search.has('frozen_time')) {
      setup.search.set('frozen_time', String(bookmark.frozenTime))
    }
  }
  const position = options.position === undefined ? bookmark?.position : parseNumbers(options.position, 'position', [3]) as Vec3
  const angle = options.angle === undefined ? bookmark && [degrees(bookmark.aim.yaw), degrees(bookmark.aim.pitch)] : parseNumbers(options.angle, 'angle', [2, 3])
  const fov = options.fov === undefined ? bookmark?.fov : parseNumbers(options.fov, 'fov', [1])[0]
  if (fov !== undefined && (fov <= 0 || fov >= 180)) {
    throw new Error('--fov must be between 0 and 180 degrees.')
  }
  const jxlDistance = parseNumbers(options['jxl-distance'], 'jxl-distance', [1])[0]
  const effort = parseNumbers(options['jxl-effort'], 'jxl-effort', [1])[0]
  if (!Number.isInteger(effort) || effort < 1 || effort > 10) {
    throw new Error('--jxl-effort must be a whole number from 1 to 10.')
  }
  const wireframe = options.wireframe === undefined ? undefined : JSON.parse(options.wireframe) as unknown
  if (wireframe !== undefined && (typeof wireframe !== 'object' || wireframe === null || Array.isArray(wireframe))) {
    throw new Error('--wireframe needs a JSON object of set_wireframe input.')
  }
  await using server = await serveGallery(setup, {cacheDir: 'node_modules/.vite-snap'})
  console.log(`Loading ${server.url}`)
  let pose: {
    fov: number | null
    position: Vec3
    rotation: Vec3
  } | undefined
  // The page renders and encodes the photo itself; download_frame hands it over as a browser download.
  const capture = await capturePage(server.url, {
    browser: Bun.env.BROWSER,
    args: ['--enable-unsafe-webgpu'],
    ...setup.viewport,
    body: false,
    capture: 'download',
    // Loading only gives up once nothing finishes for a while; Knottingham’s Knot materials alone take minutes.
    timeout: 1_800_000,
    wait: 'domcontentloaded',
    hook: async page => {
      watchPage(page)
      await waitForGallery(page)
      pose = await page.evaluate((requested: Partial<CameraPose>) => globalThis.slopGallery!.pose!(requested), {
        position,
        rotation: angle ? [radians(angle[1]), radians(angle[0]), radians(angle[2] ?? 0)] as Vec3 : undefined,
        fov,
      })
      if (wireframe) {
        await setWireframe(page, wireframe as Record<string, unknown>)
      }
      // A new pose can bring artworks into view that still need decoding, and objects whose pipelines still compile.
      await waitForFrames(page, settle)
      await waitForLoadingItems(page)
      // All of it loaded at the warmup scale; the photo renders at the full size, after frames that build TRAA’s history there.
      const warmup = await endWarmup(page)
      if (warmup.warmed) {
        await waitForFrames(page, settle)
        await waitForLoadingItems(page)
      }
      await waitForFrames(page, settle)
    },
    // Dumps before rendering, like X: the frame shows the view the dump describes.
    toolCalls: [{
      name: 'download_frame',
      input: {format: 'png'},
    }],
  })
  const frame = capture.toolResults[0] as DownloadFrameResult
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
    /** the camera the photo was taken from */
    pose: pose!,
    /** the size the canvas rendered at, larger than the photo with --scale above 1 */
    source: {
      width: frame.width,
      height: frame.height,
    },
    width,
  }
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...snapOptions,
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    const {dump, height, output, pose, source, width} = await main(values)
    const [pitch, yaw, roll] = pose.rotation
    console.log(`Wrote ${relative(repositoryRoot, output).replaceAll('\\', '/')} (${width}×${height}${source.width === width && source.height === height ? '' : `, downsampled from ${source.width}×${source.height}`})${dump ? ' and its .msgpack X dump' : ''}`)
    console.log(`--position ${pose.position.map(value => Math.round(value * 1000) / 1000).join(',')} --angle ${[yaw, pitch, roll].map(degrees).join(',')} --fov ${pose.fov}`)
  }
}
