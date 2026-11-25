import type {Pair} from './lib/benchmarkFrames.ts'
import type {BenchmarkSetup} from './lib/benchmarkSetup.ts'
import type {GalleryValues, LooseOptions} from './lib/headlessGallery.ts'
import type {Page} from 'puppeteer-core'

import {parseArgs} from 'node:util'

import {endWarmup, executeWebmcpTool, waitForLoadingItems} from 'capture-session/script'

import {compareFramePairs, frameIntervals, frameMetrics, uncappedFrameArgs} from './lib/benchmarkFrames.ts'
import {resolveBenchmarkSetup} from './lib/benchmarkSetup.ts'
import {galleryHelp, galleryOptions, normalizeOptions, openHeadlessGallery, resolveSettle, waitForFrames, waitForGallery, warnAboutDevServer} from './lib/headlessGallery.ts'

export type {BenchmarkSetup} from './lib/benchmarkSetup.ts'

const defaultHeight = 2160
const options = {
  ...galleryOptions,
  seed: {
    type: 'string',
    default: '0',
  },
  repeats: {
    type: 'string',
    default: '4',
  },
  seconds: {
    type: 'string',
    default: '5',
  },
  settle: {
    type: 'string',
    default: '120',
  },
} as const
const defaults = parseArgs({
  args: [],
  options,
}).values
export type BenchmarkDeltaOptions = LooseOptions<Values>
type Values = typeof defaults & GalleryValues
type Setup = Awaited<ReturnType<typeof resolveBenchmarkSetup>>

const help = `Usage: bun scripts/benchmarkDelta.ts <baseline> <candidate> [options]

Each setup is a dist directory, a JSON object or a .json file containing one. {} uses the shared options. An explicit target in a file is relative to that file. For example:

  bun scripts/benchmarkDelta.ts dist-before dist-after --spawn lobby-overview
  bun scripts/benchmarkDelta.ts '{}' '{"parameters":{"anti_aliasing":false}}' --room studio --format markdown
  bun scripts/benchmarkDelta.ts '{}' tuned.json --room studio --development true

  tuned.json: {"target":"dist","parameters":{"seed":0},"tools":[{"name":"set_world_tuning","input":{"values":{"pipeline":{"bloom":false}}}}]}

Tools run in array order on every fresh page; names may repeat and input defaults to {}. For a call that reloads the page, like set_seed or a change to the Studio’s width, add "reload":true to that call.

  --repeats <count>       paired runs, alternating baseline/candidate then candidate/baseline. Default: ${defaults.repeats}
  --seconds <seconds>     time to sample uncapped animation frame intervals per run, after preparation. Default: ${defaults.seconds}
  --settle <frames>       full-size frames to render after preparation, before sampling. Default: ${defaults.settle}
  --format <json|markdown>
                          JSON includes both setups and every run; Markdown prints the comparison. Default: json
${galleryHelp(defaultHeight, {seed: defaults.seed})}
  -h, --help              show this help

The comparison gives median and p95 frame time in ms and throughput in frames per second. Delta is candidate minus baseline, percent is relative to baseline, both calculated per pair before taking the median. Lower frame times and higher FPS are better. Set BROWSER to a WebGPU-capable Chromium executable. Progress goes to stderr.`
/** After a load or a tool call, let newly visible objects register, finish streaming and reach the regular drawing buffer size. */
const settleScene = async (page: Page) => {
  await waitForFrames(page, 2)
  await waitForLoadingItems(page)
  const {warmed, width, height} = await endWarmup(page)
  if (warmed) {
    await waitForFrames(page, 2)
    await waitForLoadingItems(page)
  }
  return {
    width,
    height,
  }
}
const measure = async (setup: Setup, seconds: number, settle: number) => {
  await using gallery = await openHeadlessGallery(setup, {
    args: uncappedFrameArgs,
    cacheDir: 'node_modules/.vite-benchmark-delta',
  })
  const {page} = gallery
  let drawingBuffer = await settleScene(page)
  for (const {name, input, reload} of setup.tools) {
    console.error(`Preparing ${name}`)
    const call = () => executeWebmcpTool(page, name, input)
    try {
      if (reload) {
        await Promise.all([page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: 300_000,
        }), call()])
        await waitForGallery(page, {fly: setup.test})
      } else {
        await call()
      }
    } catch (error) {
      throw new Error(`WebMCP preparation “${name}” failed.`, {cause: error})
    }
    drawingBuffer = await settleScene(page)
  }
  await waitForFrames(page, settle)
  await waitForLoadingItems(page)
  // rAF still ticks even when the pause menu or a render error has stopped the game’s frames.
  const checkRendering = () => page.evaluate(() => {
    const state = globalThis.slopGallery?.snapshot?.()
    if (!state?.ready || !state.webGPU || state.frozen) {
      throw new Error('The benchmark needs a running WebGPU scene. Check for a paused world or a render error.')
    }
  })
  await checkRendering()
  const intervals = await frameIntervals(page, seconds * 1000)
  await checkRendering()
  return {
    frames: intervals.length,
    drawingBuffer,
    ...frameMetrics(intervals),
  }
}
const describe = ({target, search, swiftshader, tools, viewport}: Setup) => ({
  target: target ?? false,
  parameters: Object.fromEntries(search),
  viewport,
  swiftshader,
  tools,
})

/** Benchmarks two independent setups, in fresh headless browsers on the same GPU, one at a time. */
export default async function benchmarkDelta(baseline: BenchmarkSetup | string, candidate: BenchmarkSetup | string, shared: BenchmarkDeltaOptions = {}) {
  const values = {
    ...defaults,
    ...normalizeOptions<Values>(shared, options),
  }
  const repeats = Number(values.repeats)
  if (!Number.isSafeInteger(repeats) || repeats < 1) {
    throw new Error('--repeats must be a positive whole number of pairs.')
  }
  const seconds = Number(values.seconds)
  if (!(seconds > 0 && Number.isFinite(seconds * 1000))) {
    throw new Error('--seconds must be a finite, positive sample duration.')
  }
  const settle = resolveSettle(values.settle)
  const [before, after] = await Promise.all([baseline, candidate].map(input => resolveBenchmarkSetup(input, values, defaultHeight)))
  const setups = {
    baseline: before,
    candidate: after,
  }
  warnAboutDevServer(before)
  warnAboutDevServer(after)
  const pairs: Array<Pair<Awaited<ReturnType<typeof measure>>>> = []
  for (let repeat = 0; repeat < repeats; repeat++) {
    const run = async (side: keyof typeof setups) => {
      const label = `${side} (${repeat + 1}/${repeats})`
      console.error(`Measuring ${label}`)
      try {
        return await measure(setups[side], seconds, settle)
      } catch (error) {
        throw new Error(`Benchmark failed for ${label}.`, {cause: error})
      }
    }
    pairs.push(repeat % 2 ? {
      candidate: await run('candidate'),
      baseline: await run('baseline'),
    } : {
      baseline: await run('baseline'),
      candidate: await run('candidate'),
    })
  }
  return {
    metrics: compareFramePairs(pairs),
    setups: {
      baseline: describe(setups.baseline),
      candidate: describe(setups.candidate),
    },
    repeats,
    seconds,
    settle,
    pairs,
  }
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`
const table = ({metrics}: Awaited<ReturnType<typeof benchmarkDelta>>) => {
  const titles = {
    medianFrameMs: 'Median frame (ms)',
    p95FrameMs: 'p95 frame (ms)',
    fps: 'FPS',
  }
  return ['| Metric | Baseline | Candidate | Paired delta | Change |', '|---|---:|---:|---:|---:|', ...Object.entries(titles).map(([key, title]) => {
    const {baseline, candidate, delta, percent} = metrics[key as keyof typeof metrics]
    return `| ${title} | ${baseline.toFixed(2)} | ${candidate.toFixed(2)} | ${signed(delta)} | ${signed(percent)}% |`
  })].join('\n')
}
if (import.meta.main) {
  const {positionals, values} = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      ...options,
      format: {
        type: 'string',
        default: 'json',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    if (positionals.length !== 2) {
      throw new Error('Expected two setups: bun scripts/benchmarkDelta.ts <baseline> <candidate>. See --help for examples.')
    }
    if (!['json', 'markdown'].includes(values.format)) {
      throw new Error('--format must be json or markdown.')
    }
    const result = await benchmarkDelta(positionals[0], positionals[1], values)
    console.log(values.format === 'markdown' ? table(result) : JSON.stringify(result, null, 2))
  }
}
