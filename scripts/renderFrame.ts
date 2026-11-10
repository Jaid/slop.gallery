import type {CameraPose, TurntablePose} from '#src/lib/diagnostics.ts'
import type {Vec3} from '#src/lib/gallery/types.ts'
import type {GalleryValues} from './lib/headlessGallery.ts'

import {dirname, join, relative, resolve} from 'node:path'
import {parseArgs} from 'node:util'

import {createFrameSink, endWarmup, frameFormat, installVirtualClock, waitForLoadingItems} from 'capture-session/script'
import fs from 'fs-extra'
import {av1Crf} from 'knot-materials/scripts/lib/encodeAnimation.ts'

import {frameIds} from '#src/frames/lib/frameParameter.ts'
import {defaultPortraitArea} from '#src/lib/placement/portraitSlots.ts'
import artworks from '#src/worlds/gallery/artworks.ts'
import {readTurntable} from '#src/worlds/sandbox/turntable.ts'

import {galleryHelp, galleryOptions, openHeadlessGallery, parseNumbers, repositoryRoot, resolveGallerySetup, resolveSettle, serveFile, timestamp, waitForFrames, warnAboutDevServer} from './lib/headlessGallery.ts'

/** query options this script sets itself from its own, and `?ratio`, the canvas’ width per height, which the video’s size sets instead, while --ratio is the work’s */
const ownQueryOptions = ['frame', 'ratio', 'turntable', 'turntable_area', 'turntable_ratio']
const videoSize = 2160
const help = `Usage: bun scripts/renderFrame.ts <frame-id> [options]

Films a frame turning in the air, so it shows from every side, its back included: the Sandbox’s turntable (?turntable) floats a work in the frame in front of the Cell’s east wall, and the still camera films it turning round from the front, by default once in 12 s at 60 fps into a ${videoSize}×${videoSize} AV1 video that loops seamlessly.
Starts a private Vite dev server (or serves --target) and a private headless browser; never touches the visible browser. The engine clock is virtual: every frame turns the work by exactly its share of the turn, however long it takes to render.

Frames: ${frameIds.join(', ')}

Options:
  --artwork <id|file|url> the work in the frame: an artwork of the catalog by its id, an image file, which the script serves to the page, or an image URL. Default: ${artworks[0].id}
                          ${artworks.map(artwork => artwork.id).join(', ')}
  --ratio <width:height>  the work’s width per height, like 3:2, 3/2 or 1.5; the image is cropped to it evenly on both sides. Default: the artwork’s catalog ratio, or an image’s own aspect
  --area <cm²>            the work’s frame area in square centimeters, which sets its size together with the ratio. Default: ${defaultPortraitArea}
  --seconds <number>      length of the film. Default: 12
  --turns <number>        how often the work turns round in that time; whole turns loop seamlessly. Default: 1
  --fps <number>          frames per second. Default: 60
  --fov <degrees>         the camera’s vertical field of view; it stands back as far as it takes to keep the turning frame in view. Default: 36
  --settle-frames <n>     frames rendered at each frame’s moment before it is captured, so temporal antialiasing converges. Default: 8
  --settle <frames>       wall-clock frames to render before recording. Default: 2
  --output-file <file>    the extension picks the format: .webm or .mkv for AV1 video, .jxl for an animated JPEG XL, .png for one PNG per frame. Default: out/frame/<frame-id>-<timestamp>.webm
  --crf <number>          AV1 quality for .webm and .mkv, lower is better. Default: ${av1Crf}
  --jxl-distance <number> cjxl Butteraugli distance for .jxl, 0 is lossless. Default: 1
${galleryHelp(videoSize, {
  ratio: 1,
  without: ownQueryOptions,
})}
  -h, --help              show this help

Very large works stand the camera so far back that the Cell’s chandelier can come into view; a wider --fov brings it closer again.
With --scale above 1, every frame renders at that many times the size and is downsampled to --width × --height with Lanczos in linear light.

Set BROWSER to a Chromium executable with WebGPU support. ffmpeg (and cjxl for .jxl) must be on PATH.`
const frameRoot = join(repositoryRoot, 'out', 'frame')
const renderFrameOptions = {
  ...Object.fromEntries(Object.entries(galleryOptions).filter(([key]) => !ownQueryOptions.includes(key))),
  area: {type: 'string'},
  artwork: {type: 'string'},
  crf: {type: 'string'},
  fov: {
    type: 'string',
    default: '36',
  },
  fps: {
    type: 'string',
    default: '60',
  },
  'jxl-distance': {
    type: 'string',
    default: '1',
  },
  'output-file': {type: 'string'},
  ratio: {type: 'string'},
  seconds: {
    type: 'string',
    default: '12',
  },
  settle: {
    type: 'string',
    default: '2',
  },
  'settle-frames': {
    type: 'string',
    default: '8',
  },
  turns: {
    type: 'string',
    default: '1',
  },
} as const
/** how far the camera looks down on the work, in radians */
const elevation = 7 * Math.PI / 180
/** the share of the view’s height or width the turning frame takes at most */
const fill = 0.8
/** how far the work rises and sinks as it floats, see CellTurntable */
const bob = 0.02

/** the command line options without --help, as parsed strings */
export type RenderFrameOptions = Partial<Record<string, boolean | string>> & {
  fov: string
  fps: string
  graphics: string
  'jxl-distance': string
  seconds: string
  seed: string
  settle: string
  'settle-frames': string
  turns: string
}

const positiveNumber = (value: string, name: string) => {
  const [number] = parseNumbers(value, name, [1])
  if (number <= 0) {
    throw new Error(`--${name} must be positive.`)
  }
  return number
}
const looking = (eye: Vec3, target: Vec3, fov: number): Partial<CameraPose> => {
  const direction = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]
  const length = Math.hypot(...direction)
  return {
    position: eye,
    rotation: [Math.asin(direction[1] / length), Math.atan2(-direction[0], -direction[2]), 0],
    fov,
  }
}
/** The camera before the turning work, looking down on it a little, as near as it can stand with the whole frame in view at every angle, at the vertical field of view `fov` and the width per height `aspect`. */
export const turntableCamera = ({center, facing, size: [width, height, depth]}: TurntablePose, fov: number, aspect: number) => {
  const radius = Math.hypot(width, depth) / 2
  const tangent = Math.tan(fov * Math.PI / 360) * fill
  // From the nearest the frame turns toward the camera.
  const distance = radius + Math.max((height / 2 + bob) / tangent, radius / (tangent * aspect))
  const across = Math.cos(elevation) * distance
  const eye: Vec3 = [center[0] + facing[0] * across, center[1] + Math.sin(elevation) * distance, center[2] + facing[2] * across]
  return looking(eye, center, fov)
}

/** The image file the artwork names, unless it names an artwork of the catalog by its id or an image by its URL; an error for anything else. */
const artworkFile = async (artwork: string) => {
  if (artworks.some(entry => entry.id === artwork)) {
    return
  }
  const file = resolve(artwork)
  if (await fs.stat(file).then(entry => entry.isFile(), () => false)) {
    return file
  }
  if (!URL.canParse(artwork)) {
    throw new Error(`--artwork must be an artwork id (${artworks.map(entry => entry.id).join(', ')}), an image file or an image URL, got “${artwork}”.`)
  }
}
const main = async (frame: string, options: RenderFrameOptions) => {
  if (!frameIds.includes(frame as typeof frameIds[number])) {
    throw new Error(`Unknown frame “${frame}”. Frames: ${frameIds.join(', ')}`)
  }
  const ratio = options.ratio as string | undefined
  const area = options.area as string | undefined
  // The page reads them the same way.
  const turntableRequest = readTurntable(`http://localhost/?${new URLSearchParams({
    turntable: '',
    ...ratio === undefined ? {} : {turntable_ratio: ratio},
    ...area === undefined ? {} : {turntable_area: area},
  })}`)!
  if (ratio !== undefined && turntableRequest.aspect === undefined) {
    throw new Error(`--ratio expects a positive width:height like 3:2 or 3/2, or a positive number like 1.5, got “${ratio}”.`)
  }
  if (area !== undefined && turntableRequest.area === undefined) {
    throw new Error(`--area expects a positive number of square centimeters, got “${area}”.`)
  }
  const seconds = positiveNumber(options.seconds, 'seconds')
  const fps = positiveNumber(options.fps, 'fps')
  const turns = parseNumbers(options.turns, 'turns', [1])[0]
  const fov = positiveNumber(options.fov, 'fov')
  if (fov >= 180) {
    throw new Error('--fov must be below 180 degrees.')
  }
  const settleFrames = resolveSettle(options['settle-frames'])
  const crf = typeof options.crf === 'string' ? parseNumbers(options.crf, 'crf', [1])[0] : av1Crf
  const jxlDistance = parseNumbers(options['jxl-distance'], 'jxl-distance', [1])[0]
  const frameCount = Math.max(1, Math.round(seconds * fps))
  const output = typeof options['output-file'] === 'string' ? resolve(options['output-file']) : join(frameRoot, `${frame}-${timestamp()}.webm`)
  const format = frameFormat(output)
  const artwork = typeof options.artwork === 'string' ? options.artwork : artworks[0].id
  const file = await artworkFile(artwork)
  await using served = file === undefined ? undefined : serveFile(file)
  const requestedWidth = typeof options.width === 'string' ? options.width : undefined
  const requestedHeight = typeof options.height === 'string' ? options.height : undefined
  const side = requestedWidth ?? requestedHeight ?? String(videoSize)
  const values: GalleryValues = {
    // Only the gallery’s own options, so that --ratio and --area stay the work’s.
    ...Object.fromEntries(Object.entries(options).filter(([key]) => key in galleryOptions && !ownQueryOptions.includes(key))),
    graphics: options.graphics,
    seed: options.seed,
    width: requestedWidth ?? side,
    height: requestedHeight ?? side,
    frame,
    turntable: served?.url ?? artwork,
    ...ratio === undefined ? {} : {turntable_ratio: ratio},
    ...area === undefined ? {} : {turntable_area: area},
  }
  const setup = await resolveGallerySetup(values, videoSize, 1)
  warnAboutDevServer(setup)
  if (setup.world !== 'sandbox') {
    throw new Error('The turntable stands in the Sandbox, so --room may only name the Cell.')
  }
  const {width, height} = setup.viewport
  if ((format === 'webm' || format === 'mkv') && (width % 2 || height % 2)) {
    throw new Error('--width and --height need to be even for 4:2:0 video.')
  }
  const settle = resolveSettle(options.settle)
  await using gallery = await openHeadlessGallery(setup, {
    cacheDir: 'node_modules/.vite-render-frame',
    initScripts: [installVirtualClock],
  })
  const {page} = gallery
  if (!await page.evaluate(() => Boolean(globalThis.slopGallery!.holdTurntable))) {
    throw new Error('This build has no turntable. Rebuild it from a version that includes scripts/renderFrame.ts.')
  }
  const hold = (angle: number) => page.evaluate((value: number) => globalThis.slopGallery!.holdTurntable!(value), angle)
  // The image sets the work’s aspect once it has loaded, unless --ratio gives one, and with it where the camera stands.
  const frameView = async () => {
    await hold(0)
    await waitForFrames(page, settle)
    await waitForLoadingItems(page)
    await waitForFrames(page, settle)
    const pose = await hold(0)
    const camera = turntableCamera(pose, fov, width / height)
    await page.evaluate((requested: Partial<CameraPose>) => globalThis.slopGallery!.pose!(requested), camera)
    return pose
  }
  await frameView()
  // All of it loaded at the warmup scale; the film renders at the full size, after frames that build TRAA’s history there.
  const warmup = await endWarmup(page)
  if (warmup.warmed) {
    await waitForFrames(page, settle)
    await waitForLoadingItems(page)
  }
  const pose = await frameView()
  const source = await page.evaluate(async () => {
    const captured = await globalThis.slopGallery!.capturePixels!()
    return {
      width: captured.width,
      height: captured.height,
    }
  })
  await fs.mkdir(dirname(output), {recursive: true})
  const sink = createFrameSink(format, {
    crf,
    fps,
    frameCount,
    height,
    jxlDistance,
    output,
    source,
    width,
  })
  const frameBytes = source.width * source.height * 4
  let received = 0
  // Frames travel as raw RGBA request bodies; base64 through the DevTools protocol would cost more than rendering.
  const frameServer = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: frameBytes,
    async fetch(request) {
      const headers = {'Access-Control-Allow-Origin': '*'}
      const pixels = await request.bytes()
      if (pixels.byteLength !== frameBytes) {
        return new Response(`Expected ${frameBytes} bytes, got ${pixels.byteLength}.`, {
          status: 400,
          headers,
        })
      }
      if (received === 0 && !pixels.some((value, index) => index % 4 !== 3 && value > 8)) {
        return new Response('The first frame is completely black.', {
          status: 422,
          headers,
        })
      }
      await sink.write(pixels)
      received++
      return new Response(null, {
        status: 204,
        headers,
      })
    },
  })
  try {
    await page.evaluate(() => {
      globalThis.virtualClock!.start()
      // Fiber measures its first frozen delta from the last wall-clock frame; this aligns it without recording.
      globalThis.virtualClock!.step(0)
    })
    const startedAt = performance.now()
    for (let index = 0; index < frameCount; index++) {
      await page.evaluate((input: {
        angle: number
        delta: number
      }) => {
        globalThis.slopGallery!.holdTurntable!(input.angle)
        globalThis.virtualClock!.step(input.delta)
      }, {
        angle: Math.PI * 2 * turns * index / frameCount,
        delta: 1 / fps,
      })
      await waitForLoadingItems(page, {between: () => page.evaluate(() => globalThis.virtualClock!.step(0))})
      // Further frames at the same moment, which let TRAA converge on the turned work.
      await page.evaluate(async (input: {
        settle: number
        url: string
      }) => {
        for (let step = 0; step < input.settle; step++) {
          globalThis.virtualClock!.step(0)
        }
        const {pixels} = await globalThis.slopGallery!.capturePixels!()
        const response = await fetch(input.url, {
          method: 'POST',
          body: pixels,
        })
        if (!response.ok) {
          throw new Error(await response.text())
        }
      }, {
        settle: settleFrames,
        url: `http://127.0.0.1:${frameServer.port}/`,
      })
      const rendered = index + 1
      if (rendered % Math.round(fps) !== 0 && rendered !== frameCount) {
        continue
      }
      const rate = rendered / ((performance.now() - startedAt) / 1000)
      console.error(`Rendered ${(rendered / fps).toFixed(1)}/${(frameCount / fps).toFixed(1)} s (frame ${rendered}/${frameCount}, ${rate.toFixed(1)} frames per second)`)
    }
  } catch (error) {
    sink.abort()
    throw error
  } finally {
    await frameServer.stop(true)
  }
  await sink.finish()
  return {
    format,
    fps,
    frameCount,
    height,
    output,
    pose,
    width,
  }
}

export default main

if (import.meta.main) {
  const {positionals, values} = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      ...renderFrameOptions,
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help || positionals.length === 0) {
    console.log(help)
  } else {
    if (positionals.length > 1) {
      throw new Error(`Only one frame at a time, got ${positionals.join(', ')}.`)
    }
    const {format, fps, frameCount, height, output, pose, width} = await main(positionals[0], values as RenderFrameOptions)
    const inRepository = relative(repositoryRoot, output)
    const written = (inRepository.startsWith('..') ? output : inRepository).replaceAll('\\', '/')
    const [frameWidth, frameHeight] = pose.size.map(meters => Math.round(meters * 100))
    console.log(`Wrote ${format === 'png' ? `${frameCount} numbered PNGs for ${written}` : written} (${width}×${height}, ${frameCount} frames at ${fps} fps, ${(frameCount / fps).toFixed(2)} s, the frame ${frameWidth}×${frameHeight} cm outside)`)
  }
}
