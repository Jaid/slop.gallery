import type {CameraView} from '#src/lib/diagnostics.ts'
import type {GallerySetup, GalleryValues, InitScript, LooseOptions} from './lib/headlessGallery.ts'
import type {AudioTrack, FrameSink, Recipe, Shot} from 'capture-session/script'
import type {Arrayable} from 'type-fest'

import {tmpdir} from 'node:os'
import {parseArgs} from 'node:util'

import {audioSidecar, carriesAudio, createFrameSink, endWarmup, executeWebmcpTool, frameFormat, installVirtualAudio, installVirtualClock, parseRecipe, sampleRecipe, sampleWireframe, setWireframe, tweens, validateFrameSize, waitForLoadingItems} from 'capture-session/script'
import {dirname, join, relative, resolve} from 'forward-slash-path'
import fs from 'fs-extra'
import {av1Crf, av1Preset} from 'media-encoding'

import {readAudioOverride} from '#src/lib/audio/audioParameter.ts'

import {defaultFilmSeed, defaultSeedRange, describeInput, filmInputs} from './lib/filmInputs.ts'
import {FilmRecipeClock} from './lib/filmRecipeClock.ts'
import {anchorWorldReach, degrees, galleryHelp, galleryOptions, normalizeOptions, openHeadlessGallery, parseNumbers, radians, repositoryRoot, resolveGallerySetup, resolveSettle, timestamp, waitForFrames, warnAboutDevServer} from './lib/headlessGallery.ts'
import {StitchTimeline} from './lib/stitchTimeline.ts'

/** how many characters of a tool’s result the log shows */
const logLength = 400
/** rows of the canvas without --width or --height */
const filmHeight = 2160
/** An .avif film is a preview to pass around: on the Antiphon orbit at 720p, crf 40 at preset 3 takes 47% off crf 30 at preset 5 for a VMAF of 96.1 instead of 97.0, and SVT-AV1 4 encodes it faster than film renders it, see https://av1bench.hive.lan */
const avifDefaults = {
  crf: 40,
  height: 720,
  preset: 3,
}
/** The format the options write, from the extension of --output-file, .jxl without one. */
/** the formats that play over and over, where the last clip crossfades into the first */
const loopingFormats = new Set(['avif', 'jxl'])
const formatOf = (options: Pick<FilmValues, 'output-file'>) => frameFormat(options['output-file'] ?? 'film.jxl')
/** Its neighbors are everything a camera in its start room can see, while the rest never loads. A flight into a room beyond them sees the void there, which --world_reach all fills. */
const filmWorldReach = 'neighbors'
const help = `Usage: bun scripts/film.ts [options]

Renders a flight of the player through a world and writes it as an animated AVIF or JPEG XL, a video or a PNG sequence, with the game’s sound under --audio.
Starts a private Vite dev server (or serves --target) and a private headless browser; never touches the visible browser.
The engine clock is virtual: every frame advances the scene by exactly 1/fps seconds, however long it takes to render. Shaders and timed animations like the Lodge firelight use the movie’s time across seeds, including during crossfades, unless --frozen_time holds them still. Each take still starts its own physics and sound. Artworks that come into view are decoded before their frame is captured, so nothing pops in.
With --audio on (true, or a volume from 1 to 100, like ?audio), the page’s sound renders offline in step with the clock, at 48 kHz, so every sound starts on the frame that starts it, and the film carries it as Opus: WebM and Matroska inside, the other formats in an Opus file of the same name beside them. Sound the page plays through media elements or speech synthesis is not recorded.

Options:
  --recipe <file>         JSON camera recipe, or - to read it from stdin. Default: scripts/recipes/spawn.json, a two-second metronome sway at the gallery spawn
${galleryHelp(filmHeight, {
  seed: defaultFilmSeed,
  worldReach: filmWorldReach,
})}
  --seed-range <min..max> inclusive search range for seed wildcards. Default: ${defaultSeedRange} (the default environment and all seeds a game rolls). Literal seeds and brace expansions are coerced like ?seed, independent of the search range
  --crossfade <seconds>   crossfade picture and sound between clips, rounded to the nearest frame. Default: 0 (hard cuts). In the looping .avif and .jxl, the last clip fades into the first as well: the film starts once the first clip plays alone, ends in that crossfade and is one crossfade shorter. At most half as long as any clip, or as long as the first and the last clip in the other formats
  --list                  print the target and seed of each clip before seam rotation and exit without recording
  --output-file <file>    the extension picks the format. Default: out/film/<world>-<timestamp>.jxl
                          .jxl  animated JPEG XL
                          .avif  looping animated AVIF (AV1), a preview at ${avifDefaults.height} rows, crf ${avifDefaults.crf} and preset ${avifDefaults.preset} unless told otherwise; --audio writes a separate .opus file
                          .webm, .mkv  AV1 video
                          .png  one PNG per frame, each written to the next free name after the given one (shot.png → shot_001.png, shot_002.png, …)
  --fps <number>          frames per second. Default: 60
  --duration <seconds>    recording time per clip, rounded to the nearest frame (at least one); repeat it to give every clip a length of its own, in playing order. Default: the recipe’s length. Unless every clip is at least as long as the recipe, the clips share one continuous flight; otherwise each plays the recipe and holds its final camera pose for the remaining time
  --starting-frame <n>    frame that becomes the first frame of the output, wrapping once at the end. Count frames after applying --duration and any crossfades. Default: 1
  --jxl-distance <number> cjxl Butteraugli distance for .jxl, 0 is lossless. Default: 1
  --crf <number>          AV1 quality for .avif, .webm and .mkv, lower is better. Default: ${avifDefaults.crf} for .avif, otherwise ${av1Crf}
  --keyframe-interval <n> at most how many frames AV1 runs from one keyframe to the next; small ones, like 6, let players seek and scrub without decoding long stretches, for a larger file. Default: the encoder’s own, about 5 s
  --fast-decode <0–2>     how much AV1 compression to trade for a faster decoder: SVT-AV1’s fast-decode level, and from 1 on four tiles, which the decoder’s threads take on side by side. Default: 0
  --preset <number>       SVT-AV1 preset, lower compresses better and encodes slower. Default: ${avifDefaults.preset} for .avif, otherwise ${av1Preset}
  --settle <frames>       frames to render before recording, on the wall clock at the first keyframe, and at the same moment after a keyframe’s tools ran. Default: 2
  -h, --help              show this help

To film the same recipe across builds or seeds, repeat --target and/or --seed, or quote patterns:

  bun scripts/film.ts --target 'builds/v[12]' --seed '[12]' --recipe scripts/recipes/fountain_dolly.json --crossfade 0.25 --output-file comparison.webm

This plays v1/1, v1/2, v2/1, v2/2. --target accepts globby folder patterns, including exclusions like --target '!builds/old'; use forward slashes. Literal paths play in argument order, glob results in path order. --seed accepts minimatch patterns against decimal seeds, like '[12]' or '{10..13}'. Seed arguments play in order with each pattern’s matches sorted numerically. An argument given again plays again, so --target a --target b --target a cuts back to a.

For one continuous flight through three seeds, use --seed '{1..3}' --duration 1 with a three-second recipe. The seeds show seconds 0–1, 1–2 and 2–3; with --duration 0.5 --duration 1 --duration 1.5 instead, they show seconds 0–0.5, 0.5–1.5 and 1.5–3. A crossfade samples the same recipe time on both sides of its overlap. Recording stops with the last input; if the recipe ends first, the camera holds still while the scene and sound continue.

A recipe is a JSON array of keyframes, ordered by time:

  [
    {"time": 0, "position": [0, 1.7, 4], "yaw": 0, "pitch": 0, "fov": 60},
    {"time": 3, "position": [2, 1.7, 0], "yaw": 90, "tween": "easeInOutSine"},
    {"time": 5, "pitch": -20, "roll": 10, "fov": 40, "tween": "easeOutCubic"}
  ]

  time      seconds since the start of the video. Required
  position  [x, y, z] position of the player’s eyes in meters; the player flies, so the room they are in is the player’s
  orbit     {"from": [x,y,z], "to": [x,y,z], "focus": [x,y,z]}: fly from one eye position to the other while looking at the focus. to defaults to from, so {"from": …, "focus": …, "turns": 1} circles once. The arc starts at the previous position, yaw, pitch or orbit keyframe (or 0) and ends at this keyframe’s time. The keyframe’s tween controls the shortest horizontal arc, radius and height. Set orbit.heightTween (e.g. "easeInQuad") to ease height independently. Optional integer turns adds whole revolutions in the positive or negative yaw direction. See scripts/recipes/fountain_orbit.json
  yaw       degrees, 0 looks toward −z, positive turns left. Not wrapped, so 0 → 720 spins twice
  pitch     degrees, positive looks up
  roll      degrees, positive tilts the camera counterclockwise
  fov       vertical field of view in degrees, which a mood of the room may widen like for any player, unless --fov, which mirrors ?fov, gives the film a field of view of its own to start from
  tween     how this keyframe’s properties travel toward it from their previous keyframe. Default: linear
            ${Object.keys(tweens).join(', ')}
  wireframe input for the app’s set_wireframe WebMCP tool, in effect from this keyframe on. See below
  tools     the app’s WebMCP tools to run once right before the first frame at or after this keyframe, by name with their input, in order, like
            {"throw_prop": {"prop": "prop-orb-spook", "portrait": "goose"}}; their results go to stderr, the first ${logLength} characters of each

Each property animates on its own track, so a keyframe only affects the properties it sets. Before its first keyframe and after its last, a property holds still; properties no keyframe sets stay at the player spawn’s camera.
By default a clip lasts until the last keyframe, which is not rendered itself: 1 second at 60 fps is 60 frames, and a recipe that ends where it starts loops seamlessly.

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
/** samples per second the film’s sound renders at, like the live game’s and Opus’ own */
const sampleRate = 48_000
const filmOptions = {
  ...galleryOptions,
  seed: {
    type: 'string',
    multiple: true,
  },
  target: {
    type: 'string',
    multiple: true,
  },
  'seed-range': {type: 'string'},
  crossfade: {type: 'string'},
  duration: {
    type: 'string',
    multiple: true,
  },
  crf: {type: 'string'},
  'fast-decode': {type: 'string'},
  fps: {
    type: 'string',
    default: '60',
  },
  'jxl-distance': {
    type: 'string',
    default: '1',
  },
  'keyframe-interval': {type: 'string'},
  'output-file': {type: 'string'},
  preset: {type: 'string'},
  recipe: {type: 'string'},
  settle: {
    type: 'string',
    default: '2',
  },
  'starting-frame': {
    type: 'string',
    default: '1',
  },
  world_reach: {
    type: 'string',
    default: filmWorldReach,
  },
} as const

export type FilmOptions = LooseOptions<FilmValues>
/** the options as the command line gives them, the query options the gallery passes on included */
type FilmValues = Omit<GalleryValues, 'duration' | 'seed' | 'target'> & Omit<ParsedOptions, 'duration' | 'seed' | 'target'> & Parameters<typeof filmInputs>[0] & {
  /** the seconds of every clip, or one length for all of them */
  duration?: Arrayable<string>
}
/** the command line options without --help, as parsed strings */
type ParsedOptions = ReturnType<typeof parseArgs<{options: typeof filmOptions}>>['values']

/** Reads the recipe once (including stdin), unless it came as keyframes, and resolves settings common to every take of the movie’s `clips`. */
const prepareFilm = async (options: FilmValues, setup: GallerySetup, clips: number, keyframes?: Recipe) => {
  const readRecipe = async (file = join(import.meta.dir, 'recipes', 'spawn.json')): Promise<unknown> => JSON.parse(file === '-' ? await Bun.stdin.text() : await fs.readFile(file, 'utf8'))
  const recipe = parseRecipe(keyframes ?? await readRecipe(options.recipe))
  const output = options['output-file'] === undefined ? join(filmRoot, `${setup.world}-${timestamp()}.jxl`) : resolve(options['output-file'])
  const format = frameFormat(output)
  const avif = format === 'avif'
  const crf = options.crf === undefined ? (avif ? avifDefaults.crf : av1Crf) : parseNumbers(options.crf, 'crf', [1])[0]
  const jxlDistance = parseNumbers(options['jxl-distance'], 'jxl-distance', [1])[0]
  const keyframeInterval = options['keyframe-interval'] === undefined ? undefined : parseNumbers(options['keyframe-interval'], 'keyframe-interval', [1])[0]
  if (keyframeInterval !== undefined && !(Number.isSafeInteger(keyframeInterval) && keyframeInterval >= 1)) {
    throw new Error('--keyframe-interval must be a whole number of frames, at least 1.')
  }
  const fastDecode = parseNumbers(options['fast-decode'] ?? '0', 'fast-decode', [1])[0]
  if (![0, 1, 2].includes(fastDecode)) {
    throw new Error('--fast-decode must be 0, 1 or 2.')
  }
  const preset = options.preset === undefined ? (avif ? avifDefaults.preset : av1Preset) : parseNumbers(options.preset, 'preset', [1])[0]
  if (!(Number.isSafeInteger(preset) && preset >= -1 && preset <= 13)) {
    throw new Error('--preset must be a whole number from -1 to 13.')
  }
  const fps = parseNumbers(options.fps, 'fps', [1])[0]
  if (fps <= 0) {
    throw new Error('--fps must be positive.')
  }
  const settle = resolveSettle(options.settle)
  const {width, height} = setup.viewport
  validateFrameSize(format, width, height)
  const clock = new FilmRecipeClock(recipe, fps, options.duration === undefined ? undefined : [options.duration].flat().map(Number), clips)
  return {
    clock,
    encoding: {
      audio: readAudioOverride(`http://localhost/?${setup.search}`) === true,
      crf,
      fastDecode,
      fps,
      height,
      jxlDistance,
      keyframeInterval,
      output,
      preset,
      width,
    },
    format,
    recipe,
    settle,
  }
}

type Film = Awaited<ReturnType<typeof prepareFilm>>
type FrameWriter = (source: GallerySetup['viewport']) => FrameSink['write']

/** Records one whole take on a fresh virtual clock. Its frames are delivered at the canvas size, before downsampling and encoding. */
const captureFilm = async ({encoding: {audio: audible, fps}, recipe, settle}: Film, setup: GallerySetup, {animationSecondsAt, callsAt, frameCount, secondsAt: frameSeconds}: ReturnType<FilmRecipeClock['take']>, frames: FrameWriter) => {
  warnAboutDevServer(setup)
  // The first frame shows the clock 1/fps after it started, which is where the film’s sound begins.
  const leadIn = 1 / fps
  const toView = (shot: Shot): Partial<CameraView> => ({
    position: shot.position,
    rotation: [radians(shot.pitch), radians(shot.yaw), radians(shot.roll)],
    fov: shot.fov,
  })
  const initScripts: Array<InitScript> = [[installVirtualClock, animationSecondsAt(0)]]
  if (audible) {
    initScripts.push([installVirtualAudio, {
      duration: leadIn + frameCount / fps,
      sampleRate,
    }])
  }
  // The camera’s first position, unless the recipe leaves it at the spawn.
  const firstPosition = recipe.some(keyframe => keyframe.position || keyframe.orbit) ? sampleRecipe(recipe, frameSeconds(0), {
    position: [0, 0, 0],
    yaw: 0,
    pitch: 0,
    roll: 0,
    fov: 60,
  }).position : undefined
  await anchorWorldReach(setup, firstPosition)
  await using gallery = await openHeadlessGallery(setup, {
    cacheDir: 'node_modules/.vite-film',
    initScripts,
  })
  const {page} = gallery
  const spawn = await page.evaluate(() => globalThis.slopGallery!.fly!())
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
  const first = toView(sampleRecipe(recipe, frameSeconds(0), fallback))
  await page.evaluate((view: Partial<CameraView>) => globalThis.slopGallery!.fly!(view), first)
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
  const write = frames(source)
  const frameBytes = source.width * source.height * 4
  // stereo at 32 bits, with a second to spare
  const audioBytes = Math.ceil((leadIn + frameCount / fps + 1) * sampleRate) * 2 * 4
  let received = 0
  let audio: AudioTrack | undefined
  /** what the recipe’s tool calls returned, in the order they ran */
  const results: Array<{
    name: string
    /** the tool’s result as the page returned it, JSON for the app’s own tools */
    result: string
    time: number
  }> = []
  // Frames travel as raw RGBA request bodies, and the sound as raw samples; base64 through the DevTools protocol would cost more than rendering.
  const frameServer = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: Math.max(frameBytes, audible ? audioBytes : 0),
    async fetch(request) {
      const headers = {'Access-Control-Allow-Origin': '*'}
      const {pathname, searchParams} = new URL(request.url)
      if (pathname === '/audio') {
        const bytes = await request.arrayBuffer()
        audio = {
          channels: Number(searchParams.get('channels')),
          sampleRate: Number(searchParams.get('rate')),
          samples: new Float32Array(bytes),
        }
        return new Response(null, {
          status: 204,
          headers,
        })
      }
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
      await write(pixels)
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
      globalThis.virtualClock!.start()
      // Fiber measures its first frozen delta from the last wall-clock frame; this aligns it without recording.
      globalThis.virtualClock!.step(0)
    })
    const startedAt = performance.now()
    for (let index = 0; index < frameCount; index++) {
      const view = toView(sampleRecipe(recipe, frameSeconds(index), fallback))
      const frameFlood = flood(index)
      if (frameFlood) {
        await setWireframe(page, frameFlood)
      }
      const frameCalls = callsAt(index)
      // The sound renders up to the frame’s moment first, so whatever the frame starts sounds from there.
      await page.evaluate(async (frame: {
        animationSeconds: number
        delta: number
        step: boolean
        view: Partial<CameraView>
      }) => {
        globalThis.virtualClock!.animationSeconds = frame.animationSeconds
        globalThis.slopGallery!.fly!(frame.view)
        await globalThis.virtualAudio?.advance(frame.delta)
        if (frame.step) {
          globalThis.virtualClock!.step(frame.delta)
        }
      }, {
        animationSeconds: animationSecondsAt(index),
        delta: 1 / fps,
        step: !frameCalls,
        view,
      })
      if (frameCalls) {
        for (const {input, name, time} of frameCalls) {
          const result = await executeWebmcpTool(page, name, input)
          // Dumps run long; scripts get every result in full from main.
          console.error(`${name} at ${time} s: ${result.length > logLength ? `${result.slice(0, logLength)}… (${result.length} characters)` : result}`)
          results.push({
            name,
            result,
            time,
          })
        }
        await page.evaluate((delta: number) => globalThis.virtualClock!.step(delta), 1 / fps)
      }
      // The clock stands still while whatever just came into view loads; frames at the same moment let what needs them, like objects streaming in, get there.
      const still = () => page.evaluate(() => globalThis.virtualClock!.step(0))
      await waitForLoadingItems(page, {between: still})
      if (frameCalls) {
        // A tool can change how everything renders, like set_graphics_quality, whose first frames lack shadow maps and TRAA’s history: frames at the same moment settle them, like before the first frame.
        for (let frame = 0; frame < settle; frame++) {
          await still()
        }
        await waitForLoadingItems(page, {between: still})
      }
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
      console.log(`Rendered ${(rendered / fps).toFixed(1)}/${(frameCount / fps).toFixed(1)} s (frame ${rendered}/${frameCount}, ${rate.toFixed(1)} frames per second)`)
    }
    if (audible) {
      // The sound before the first frame’s moment is left out.
      const recorded = await page.evaluate(async (input: {
        leadIn: number
        url: string
      }) => {
        const recording = await globalThis.virtualAudio!.finish()
        if (!recording) {
          return false
        }
        const {channels, samples} = recording
        const response = await fetch(`${input.url}audio?channels=${channels}&rate=${recording.sampleRate}`, {
          method: 'POST',
          body: samples.subarray(Math.round(input.leadIn * recording.sampleRate) * channels),
        })
        if (!response.ok) {
          throw new Error(await response.text())
        }
        return true
      }, {
        leadIn,
        url: frameUrl,
      })
      if (!recorded) {
        console.warn('Warning: the page never made an audio context, so the film has no sound.')
      }
    }
  } finally {
    await frameServer.stop(true)
  }
  return {
    audio,
    tools: results,
  }
}
const filmDefaults = parseArgs({
  options: filmOptions,
  args: [],
}).values
/** Opens one encoder at the first take’s canvas size and keeps it for the entire movie. Its camera follows the keyframes of `recipe`, or else those of the file --recipe names. */
const main = async (overrides: FilmOptions, recipe?: Recipe) => {
  const options: FilmValues = {
    ...filmDefaults,
    ...normalizeOptions<FilmValues>(overrides, filmOptions),
  }
  if (recipe && options.recipe !== undefined) {
    throw new Error('Pass the keyframes either as the second argument or as the file --recipe names, not both.')
  }
  const inputs = await filmInputs(options)
  const defaultHeight = formatOf(options) === 'avif' ? avifDefaults.height : filmHeight
  const first = await resolveGallerySetup({
    ...options,
    ...inputs[0],
  }, defaultHeight)
  const film = await prepareFilm(options, first, inputs.length, recipe)
  const {encoding, format} = film
  const {fps, height, output, width} = encoding
  const [startingFrame] = parseNumbers(options['starting-frame'], 'starting-frame', [1])
  const timeline = new StitchTimeline(film.clock.clipFrames, fps, Number(options.crossfade ?? 0), startingFrame, {loop: loopingFormats.has(format)})
  const {frameCount} = timeline
  await fs.mkdir(dirname(output), {recursive: true})
  const scratch = timeline.fadeFrames || timeline.offset ? await fs.mkdtemp(join(tmpdir(), 'film-stitch-')) : undefined
  let sink: FrameSink | undefined
  let size: GallerySetup['viewport'] | undefined
  const tools: Awaited<ReturnType<typeof captureFilm>>['tools'] = []
  try {
    await timeline.stitch(async (clip, accept) => {
      const input = inputs[clip]
      if (inputs.length > 1) {
        console.error(`Recording clip ${clip + 1}/${inputs.length}: ${describeInput(input)}`)
      }
      const setup = clip === 0 ? first : await resolveGallerySetup({
        ...options,
        ...input,
      }, defaultHeight)
      const take = film.clock.take(clip, timeline.clipStart(clip), timeline.recipeStart, timeline.loops ? frameCount : undefined)
      const recording = await captureFilm(film, setup, take, source => {
        if (size && (size.width !== source.width || size.height !== source.height)) {
          throw new Error(`Canvas size changed between takes: ${size.width}×${size.height} → ${source.width}×${source.height}.`)
        }
        size = source
        sink ??= createFrameSink(format, {
          ...encoding,
          frameCount,
          source,
        })
        return accept
      })
      if (recording.audio) {
        timeline.mix(clip, recording.audio)
      }
      for (const tool of recording.tools) {
        tools.push(tool)
      }
    }, pixels => sink!.write(pixels), scratch)
    const {audio} = timeline
    await sink!.finish(audio)
    return {
      /** where the sound went, if any */
      audio: audio && (carriesAudio(format) ? output : audioSidecar(output)),
      format,
      fps,
      frameCount,
      height,
      output,
      tools,
      width,
    }
  } catch (error) {
    sink?.abort()
    throw error
  } finally {
    if (scratch) {
      await fs.remove(scratch)
    }
  }
}
const shorten = (file: string) => relative(repositoryRoot, file)
const reportFilm = ({audio, format, fps, frameCount, height, output, width}: Awaited<ReturnType<typeof main>>) => {
  const written = shorten(output)
  let sound = ''
  if (audio !== undefined) {
    sound = audio === output ? ' with sound' : `, sound in ${shorten(audio)}`
  }
  console.log(`Wrote ${format === 'png' ? `${frameCount} numbered PNGs for ${written}` : written} (${width}×${height}, ${frameCount} frames at ${fps} fps, ${(frameCount / fps).toFixed(2)} s${sound})`)
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...filmOptions,
      list: {type: 'boolean'},
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else if (values.list) {
    for (const input of await filmInputs(values)) {
      console.log(describeInput(input))
    }
  } else {
    reportFilm(await main(values))
  }
}
