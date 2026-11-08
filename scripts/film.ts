import type {CameraPose} from '#src/lib/diagnostics.ts'
import type {Shot} from 'capture-session/script'

import {dirname, join, relative, resolve} from 'node:path'
import {parseArgs} from 'node:util'

import {createFrameSink, endWarmup, frameFormat, installVirtualClock, parseRecipe, recipeDuration, sampleRecipe, sampleWireframe, setWireframe, tweens, waitForLoadingItems} from 'capture-session/script'
import fs from 'fs-extra'
import {av1Crf} from 'knot-materials/scripts/lib/encodeAnimation.ts'

import {degrees, galleryHelp, galleryOptions, openHeadlessGallery, parseNumbers, radians, repositoryRoot, resolveGallerySetup, resolveSettle, timestamp, waitForFrames, warnAboutDevServer} from './lib/headlessGallery.ts'

const help = `Usage: bun scripts/film.ts [options]

Renders a camera flight through a world and writes it as an animated JPEG XL, a video or a PNG sequence.
Starts a private Vite dev server (or serves --target) and a private headless browser; never touches the visible browser.
The engine clock is virtual: every frame advances the scene by exactly 1/fps seconds, however long it takes to render. Artworks that come into view are decoded before their frame is captured, so nothing pops in.

Options:
  --recipe <file>         JSON camera recipe, or - to read it from stdin. Default: scripts/recipes/spawn.json, a two-second metronome sway at the gallery spawn
${galleryHelp()}
  --output-file <file>    the extension picks the format. Default: out/film/<world>-<timestamp>.jxl
                          .jxl  animated JPEG XL
                          .webm, .mkv  AV1 video
                          .png  one PNG per frame, each written to the next free name after the given one (shot.png → shot_001.png, shot_002.png, …)
  --fps <number>          frames per second. Default: 60
  --starting-frame <n>    recipe frame that becomes the first frame of the output, wrapping around at the end; moves the loop seam without changing the motion. Default: 1
  --jxl-distance <number> cjxl Butteraugli distance for .jxl, 0 is lossless. Default: 1
  --crf <number>          AV1 quality for .webm and .mkv, lower is better. Default: ${av1Crf}
  --settle <frames>       wall-clock frames to render at the first keyframe before recording. Default: 2
  -h, --help              show this help

A recipe is a JSON array of keyframes, ordered by time:

  [
    {"time": 0, "position": [0, 1.7, 4], "yaw": 0, "pitch": 0, "fov": 60},
    {"time": 3, "position": [2, 1.7, 0], "yaw": 90, "tween": "easeInOutSine"},
    {"time": 5, "pitch": -20, "roll": 10, "fov": 40, "tween": "easeOutCubic"}
  ]

  time      seconds since the start of the video. Required
  position  [x, y, z] camera (eye) position in meters
  yaw       degrees, 0 looks toward −z, positive turns left. Not wrapped, so 0 → 720 spins twice
  pitch     degrees, positive looks up
  roll      degrees, positive tilts the camera counterclockwise
  fov       vertical field of view in degrees
  tween     how this keyframe’s properties travel toward it from their previous keyframe. Default: linear
            ${Object.keys(tweens).join(', ')}
  wireframe input for the app’s set_wireframe WebMCP tool, in effect from this keyframe on. See below

Each property animates on its own track, so a keyframe only affects the properties it sets. Before its first keyframe and after its last, a property holds still; properties no keyframe sets stay at the player spawn’s camera.
The video lasts until the last keyframe, which is not rendered itself: 1 second at 60 fps is 60 frames, and a recipe that ends where it starts loops seamlessly.

A wireframe flood is a sphere growing from a position that turns everything it reaches into wireframe, or back out of it. A keyframe with a new direction starts one, from radius 0 unless it sets another:

  [
    {"time": 0, "position": [0, 1.7, 4], "yaw": 0},
    {"time": 1, "wireframe": {"direction": "in", "position": [0, 0.5, -12], "speed": 20, "highlight": "lobby-fountain"}},
    {"time": 4, "wireframe": {"direction": "out", "speed": 20}},
    {"time": 6, "yaw": 30}
  ]

  direction  in turns the scene into wireframe; out starts from all wireframe and turns it back into the scene
  speed      meters per second the radius grows by; with burst above 1 it shoots out and slows down, below 1 it builds up
  position   [x, y, z] center in meters; like radius a track of its own, which never travels into a keyframe with a direction
  radius     meters, for a flood that follows the keyframes instead of a speed
Every other field of set_wireframe (mode, shape, anchor, colors, seam and glow, line_style and line_width, …) switches at its keyframe and holds from then on. Before the first direction, the scene renders as usual.

With --scale above 1, every frame renders at that many times the size and is downsampled to --width × --height with Lanczos in linear light.

Set BROWSER to a Chromium executable with WebGPU support. ffmpeg (and cjxl for .jxl) must be on PATH.`
const filmRoot = join(repositoryRoot, 'out', 'film')
const filmOptions = {
  ...galleryOptions,
  crf: {type: 'string'},
  fps: {
    type: 'string',
    default: '60',
  },
  'jxl-distance': {
    type: 'string',
    default: '1',
  },
  'output-file': {type: 'string'},
  recipe: {type: 'string'},
  settle: {
    type: 'string',
    default: '2',
  },
  'starting-frame': {
    type: 'string',
    default: '1',
  },
} as const

/** the command line options without --help, as parsed strings */
export type FilmOptions = ReturnType<typeof parseArgs<{options: typeof filmOptions}>>['values']

const main = async (options: FilmOptions) => {
  const recipeFile = options.recipe ?? join(import.meta.dir, 'recipes', 'spawn.json')
  const recipeText = recipeFile === '-' ? await Bun.stdin.text() : await fs.readFile(recipeFile, 'utf8')
  const recipe = parseRecipe(JSON.parse(recipeText))
  const duration = recipeDuration(recipe)
  if (duration === 0) {
    throw new Error('The recipe needs a keyframe with a time after 0.')
  }
  const crf = options.crf === undefined ? av1Crf : parseNumbers(options.crf, 'crf', [1])[0]
  const jxlDistance = parseNumbers(options['jxl-distance'], 'jxl-distance', [1])[0]
  const fps = parseNumbers(options.fps, 'fps', [1])[0]
  if (fps <= 0) {
    throw new Error('--fps must be positive.')
  }
  const setup = await resolveGallerySetup(options)
  warnAboutDevServer(setup)
  const settle = resolveSettle(options.settle)
  const output = options['output-file'] === undefined ? join(filmRoot, `${setup.world}-${timestamp()}.jxl`) : resolve(options['output-file'])
  const format = frameFormat(output)
  const {width, height} = setup.viewport
  if ((format === 'webm' || format === 'mkv') && (width % 2 || height % 2)) {
    throw new Error('--width and --height need to be even for 4:2:0 video.')
  }
  const frameCount = Math.max(1, Math.round(duration * fps))
  const startingFrame = parseNumbers(options['starting-frame'], 'starting-frame', [1])[0]
  if (!Number.isSafeInteger(startingFrame) || startingFrame < 1 || startingFrame > frameCount) {
    throw new Error(`--starting-frame must be a whole number between 1 and ${frameCount}.`)
  }
  const frameSeconds = (index: number) => (index + startingFrame - 1) % frameCount / fps
  const toPose = (shot: Shot): Partial<CameraPose> => ({
    position: shot.position,
    rotation: [radians(shot.pitch), radians(shot.yaw), radians(shot.roll)],
    fov: shot.fov,
  })
  await using gallery = await openHeadlessGallery(setup, {
    cacheDir: 'node_modules/.vite-film',
    initScript: installVirtualClock,
  })
  const {page} = gallery
  const spawn = await page.evaluate(() => globalThis.slopGallery!.pose!())
  const fallback: Shot = {
    position: spawn.position,
    yaw: degrees(spawn.rotation[1]),
    pitch: degrees(spawn.rotation[0]),
    roll: degrees(spawn.rotation[2]),
    fov: spawn.fov ?? 60,
  }
  // recipes with wireframe keyframes send their flood to set_wireframe before every frame; unchanged fields keep it growing
  const flood = (index: number) => sampleWireframe(recipe, frameSeconds(index))
  const firstFlood = flood(0)
  if (firstFlood) {
    await setWireframe(page, firstFlood)
  }
  const first = toPose(sampleRecipe(recipe, frameSeconds(0), fallback))
  await page.evaluate((pose: Partial<CameraPose>) => globalThis.slopGallery!.pose!(pose), first)
  await waitForFrames(page, settle)
  await waitForLoadingItems(page)
  // All of it loaded at the warmup scale; the film renders at the full size, after frames that build TRAA’s history there.
  const warmup = await endWarmup(page)
  if (warmup.warmed) {
    await waitForFrames(page, settle)
    await waitForLoadingItems(page)
  }
  await waitForFrames(page, settle)
  // With --scale the canvas renders more pixels than the film has; the sink downsamples them.
  const source = await page.evaluate(async () => {
    const frame = await globalThis.slopGallery!.capturePixels!()
    return {
      width: frame.width,
      height: frame.height,
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
    const frameUrl = `http://127.0.0.1:${frameServer.port}/`
    await page.evaluate(() => {
      // Knots turned on the wall clock while the world loaded; every film starts them at the same angle.
      globalThis.slopGallery!.resetKnotRotation?.()
      globalThis.virtualClock!.start()
      // Fiber measures its first frozen delta from the last wall-clock frame; this aligns it without recording.
      globalThis.virtualClock!.step(0)
    })
    const startedAt = performance.now()
    for (let index = 0; index < frameCount; index++) {
      const pose = toPose(sampleRecipe(recipe, frameSeconds(index), fallback))
      const frameFlood = flood(index)
      if (frameFlood) {
        await setWireframe(page, frameFlood)
      }
      await page.evaluate((frame: {
        delta: number
        pose: Partial<CameraPose>
      }) => {
        globalThis.slopGallery!.pose!(frame.pose)
        globalThis.virtualClock!.step(frame.delta)
      }, {
        delta: 1 / fps,
        pose,
      })
      // The clock stands still while whatever just came into view loads; frames at the same moment let what needs them, like objects streaming in, get there.
      await waitForLoadingItems(page, {between: () => page.evaluate(() => globalThis.virtualClock!.step(0))})
      await page.evaluate(async (url: string) => {
        const {pixels} = await globalThis.slopGallery!.capturePixels!()
        const response = await fetch(url, {
          method: 'POST',
          body: pixels,
        })
        if (!response.ok) {
          throw new Error(await response.text())
        }
      }, frameUrl)
      const rendered = index + 1
      if (rendered % Math.round(fps) !== 0 && rendered !== frameCount) {
        continue
      }
      const rate = rendered / ((performance.now() - startedAt) / 1000)
      console.log(`Rendered ${(rendered / fps).toFixed(1)}/${duration.toFixed(1)} s (frame ${rendered}/${frameCount}, ${rate.toFixed(1)} frames per second)`)
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
    width,
  }
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...filmOptions,
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    const {format, fps, frameCount, height, output, width} = await main(values)
    const written = relative(repositoryRoot, output).replaceAll('\\', '/')
    console.log(`Wrote ${format === 'png' ? `${frameCount} numbered PNGs for ${written}` : written} (${width}×${height}, ${frameCount} frames at ${fps} fps, ${(frameCount / fps).toFixed(2)} s)`)
  }
}
