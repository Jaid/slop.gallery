import type {GalleryValues, LooseOptions} from './lib/headlessGallery.ts'
import type {Page} from 'puppeteer-core'

import type {BunPlugin} from 'bun'
import {parseArgs} from 'node:util'

import {executeWebmcpTool, waitForLoadingItems} from 'capture-session/script'
import {join, relative} from 'forward-slash-path'
import fs from 'fs-extra'
import puppeteer from 'puppeteer-core'

import {galleryHelp, galleryOptions, normalizeOptions, openHeadlessGallery, repositoryRoot, resolveGallerySetup, waitForFrames, warnAboutDevServer} from './lib/headlessGallery.ts'

const benchmarkHeight = 2160
/** the default environment, so every run sees the same Cell */
const benchmarkSeed = '0'
/** what players stream at, so an orb shows up as it would for them */
const benchmarkStreamBudget = '8'
/** runs of the startup measurement, which takes milliseconds each */
const startupRepeats = 9
/** milliseconds a task must block the main thread to count as a freeze, the browser’s long task threshold */
const longTask = 50
/** where an orb lies to be met in the Cell, and where the camera looks at it from */
const encounterView = {
  eye: [0, 1.6, -7.5],
  look: [0, 0.4, -9],
  orb: [0, 0.3, -9],
  fov: 50,
}
/** how far from an orb on its pedestal the camera renders it, in meters, and its vertical field of view: close up, the orb fills the view’s height */
const renderViews = {
  close: [0.9, 17],
  far: [3, 40],
} as const
const help = `Usage: bun scripts/benchmarkOrb.ts --orb <id> [options]

Measures what an orb costs, against a baseline orb, in three ways, and prints them as JSON (or a markdown table with --format markdown):
  startup     the milliseconds Chrome takes to parse and evaluate the orb’s own modules, already downloaded, which every world pays whether it holds the orb or not, as all orbs load with the game; three and what all orbs share are loaded before. As what the orb adds to the baseline orb’s, whose own time is about what importing any module takes
  encounter   the first time the orb is drawn: the longest freeze of the main thread (only tasks of ${longTask} ms and more count), the worst frame and the milliseconds until it shows, once its pipelines compiled. It is dropped into the Sandbox’s settled Cell, ${encounterView.orb.join(', ')}, right in view. In the room a world starts in, this work happens behind the loading screen instead
  render      the uncapped median frame time with the orb alone on a pedestal of the Cell (?item), close up (${renderViews.close[0]} m, filling the view’s height) and from ${renderViews.far[0]} m, as what the orb adds to the baseline orb’s

Each value is the median of the repeats, every one a fresh page; orbs alternate their order from repeat to repeat, so drift cancels out. For steady numbers, keep the GPU at fixed clocks (like power_dpm_force_performance_level high on AMD) and the machine otherwise idle.

Options:
  --orb <id>              the orb to measure, like impasto or halloween; repeat it for several
  --baseline <id>         the orb the others are measured against. Default: transparent, the bare glass every orb is made of
  --repeats <count>       runs of the encounter and render measurements. Default: 3; startup always runs 9 times, as it takes milliseconds
  --phases <list>         which measurements to run, comma-separated: startup, encounter, render. Default: all
  --format <json|markdown>
                          json prints everything measured, markdown a table of it. Default: json
${galleryHelp(benchmarkHeight, {
  seed: benchmarkSeed,
  without: ['item', 'room'],
})}
  -h, --help              show this help

Progress goes to stderr. Set BROWSER to a Chromium executable with WebGPU support.`
const benchmarkOrbOptions = {
  ...galleryOptions,
  orb: {
    type: 'string',
    multiple: true,
  },
  baseline: {
    type: 'string',
    default: 'transparent',
  },
  repeats: {
    type: 'string',
    default: '3',
  },
  phases: {
    type: 'string',
    default: 'startup,encounter,render',
  },
  format: {
    type: 'string',
    default: 'json',
  },
  seed: {
    type: 'string',
    default: benchmarkSeed,
  },
  stream_budget: {
    type: 'string',
    default: benchmarkStreamBudget,
  },
  warmup_scale: {
    type: 'string',
    default: 'false',
  },
} as const
const defaults = parseArgs({
  options: benchmarkOrbOptions,
  args: [],
}).values
export type BenchmarkOrbOptions = LooseOptions<BenchmarkOrbValues>
type BenchmarkOrbValues = Omit<typeof defaults, 'orb'> & GalleryValues & {orb?: ReadonlyArray<string> | string}
const phases = ['startup', 'encounter', 'render'] as const
export type EncounterCost = {
  /** the longest task blocking the main thread, 0 without any of ${longTask} ms or more */
  freezeMs: number
  /** the frame time before, for comparison */
  steadyFrameMs: number
  /** from dropping the orb in until nothing is left loading, its pipelines compiled */
  visibleMs: number
  /** the longest frame from dropping the orb in until half a second after it showed */
  worstFrameMs: number
}
export type RenderCost = Record<keyof typeof renderViews, number>
export type OrbCost = {
  encounter?: EncounterCost
  orb: string
  /** what the orb adds to the baseline’s frame time; the baseline’s own entry holds its whole frame time */
  render?: RenderCost
  /** what parsing and evaluating the orb’s own modules adds to the baseline’s; the baseline’s own entry holds its whole time */
  startupMs?: number
}
type Phase = typeof phases[number]

const median = (values: ReadonlyArray<number>) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
const round = (value: number) => Math.round(value * 10) / 10
/** Finds the module that defines the orb `id`: the class in src/orbs whose `id` it is. */
const findOrbModule = async (id: string) => {
  const found: Record<string, string> = {}
  const modules = new Bun.Glob('src/orbs/*/*.ts')
  for await (const file of modules.scan(repositoryRoot)) {
    const match = /readonly id = '(?<orb>[^']+)'/u.exec(await Bun.file(join(repositoryRoot, file)).text())
    if (match?.groups && !file.startsWith('src/orbs/base/')) {
      found[match.groups.orb] = join(repositoryRoot, file)
    }
  }
  if (!found[id]) {
    throw new Error(`There is no orb “${id}”. Orbs: ${Object.keys(found).toSorted().join(', ')}.`)
  }
  return found[id]
}
/** Assets imported with attributes, like an orb’s photo.jxl, which only the game’s Vite plugins build; their URL doesn’t matter for evaluating modules. */
const assetStubs: BunPlugin = {
  name: 'asset-stubs',
  setup(build) {
    build.onLoad({filter: /\.(?:avif|jpe?g|jxl|opus|png|svg|webp)$/u}, () => ({
      contents: 'export default ""',
      loader: 'js',
    }))
  },
}
/** Bundles the orbs for the startup measurement into `folder`: shared.js with three and everything of src/orbs/base and src/orbs/lib, which every orb pays for anyway, and one entry per orb with its own modules. */
const bundleOrbs = async (folder: string, orbs: ReadonlyArray<string>) => {
  const entries = join(folder, 'entries')
  await fs.ensureDir(entries)
  const shared = ['three/webgpu', 'three/tsl']
  const sharedModules = new Bun.Glob('src/orbs/{base,lib}/*.ts')
  for await (const file of sharedModules.scan(repositoryRoot)) {
    shared.push(join(repositoryRoot, file))
  }
  await Bun.write(join(entries, 'shared.ts'), shared.map(module => `import ${JSON.stringify(module)}\n`).join(''))
  for (const orb of orbs) {
    await Bun.write(join(entries, `orb-${orb}.ts`), `import ${JSON.stringify(await findOrbModule(orb))}\n`)
  }
  const output = join(folder, 'out')
  const result = await Bun.build({
    entrypoints: ['shared', ...orbs.map(orb => `orb-${orb}`)].map(name => join(entries, `${name}.ts`)),
    outdir: output,
    // Every entry right in the output folder, under its own name, whichever modules the entries reach.
    root: entries,
    naming: {
      entry: '[name].[ext]',
      chunk: 'chunk-[hash].[ext]',
    },
    splitting: true,
    target: 'browser',
    format: 'esm',
    minify: true,
    plugins: [assetStubs],
  })
  if (!result.success) {
    throw new AggregateError(result.logs, 'Bundling the orbs failed.')
  }
  // Downloaded into the cache ahead of time, so only parsing and evaluating them is timed.
  const files = result.outputs.map(entry => relative(output, entry.path))
  await Bun.write(join(output, 'index.html'), `<!doctype html><script type="module">
try {
  const orb = new URLSearchParams(location.search).get('orb')
  await import('./shared.js')
  await Promise.all(${JSON.stringify(files)}.map(async file => {
    const response = await fetch(\`./\${file}\`)
    if (!response.ok) {
      throw new Error(\`\${file} did not load\`)
    }
    await response.arrayBuffer()
  }))
  await new Promise(resolve => setTimeout(resolve, 300))
  const start = performance.now()
  await import(\`./orb-\${orb}.js\`)
  document.title = String(performance.now() - start)
} catch (error) {
  document.title = \`failed: \${error}\`
}
</script>`)
  return output
}
const measureStartup = async (orbs: ReadonlyArray<string>) => {
  // Inside the repository, where the entries resolve its packages.
  await fs.ensureDir(join(repositoryRoot, 'node_modules', '.cache'))
  const folder = await fs.mkdtemp(join(repositoryRoot, 'node_modules', '.cache', 'benchmark-orb-'))
  await using _folder = {
    [Symbol.asyncDispose]: () => fs.rm(folder, {
      recursive: true,
      force: true,
    }),
  }
  const root = await bundleOrbs(folder, orbs)
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const file = Bun.file(join(root, url.pathname === '/' ? 'index.html' : url.pathname))
      // Cacheable, so the page can download every module before it times one.
      return await file.exists() ? new Response(file, {headers: {'Cache-Control': 'max-age=3600'}}) : new Response('Not found', {status: 404})
    },
  })
  await using _server = {[Symbol.asyncDispose]: () => server.stop(true)}
  await using browser = await puppeteer.launch({
    executablePath: Bun.env.BROWSER,
    headless: true,
  })
  const times: Record<string, Array<number>> = Object.fromEntries(orbs.map(orb => [orb, []]))
  for (let repeat = 0; repeat < startupRepeats; repeat++) {
    for (const orb of repeat % 2 ? orbs.toReversed() : orbs) {
      // A context of its own each time, so nothing stays cached from the last run.
      await using context = await browser.createBrowserContext()
      const page = await context.newPage()
      page.on('pageerror', error => console.error(`Page error: ${String(error)}`))
      await page.goto(`http://127.0.0.1:${server.port}/?orb=${encodeURIComponent(orb)}`)
      await page.waitForFunction(() => document.title !== '', {timeout: 60_000})
      const title = await page.title()
      if (title.startsWith('failed: ')) {
        throw new Error(`Evaluating the ${orb} orb ${title}.`)
      }
      times[orb].push(Number(title))
    }
  }
  return Object.fromEntries(orbs.map(orb => [orb, median(times[orb])]))
}
const settle = async (page: Page) => {
  await waitForFrames(page, 10)
  await waitForLoadingItems(page)
  await waitForFrames(page, 120)
  await waitForLoadingItems(page)
  await new Promise(resolve => setTimeout(resolve, 1500))
}
const fly = (page: Page, eye: ReadonlyArray<number>, target: ReadonlyArray<number>, fov: number) => {
  const [x, y, z] = target.map((value, axis) => value - eye[axis])
  return page.evaluate((view: {
    fov: number
    position: Array<number>
    rotation: Array<number>
  }) => globalThis.slopGallery!.fly!(view as never), {
    position: [...eye],
    rotation: [Math.atan2(y, Math.hypot(x, z)), Math.atan2(-x, -z), 0],
    fov,
  })
}
/** the median of the uncapped frame intervals over `milliseconds` */
const frameTime = (page: Page, milliseconds = 5000) => page.evaluate(async (duration: number) => {
  const stamps: Array<number> = []
  await new Promise<void>(resolve => {
    const tick = (time: number) => {
      stamps.push(time)
      if (time - stamps[0] < duration) {
        requestAnimationFrame(tick)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
  const intervals = stamps.slice(1).map((time, index) => time - stamps[index]).toSorted((a, b) => a - b)
  return intervals[Math.floor(intervals.length / 2)]
}, milliseconds)
/** uncapped frames, which a frame time needs */
const benchmarkPage = {
  args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
  cacheDir: 'node_modules/.vite-benchmark-orb',
}
const isEmpty = (items: string) => !items || /^Operation succeeded\.?$/u.test(items)
const measureEncounter = async (values: BenchmarkOrbValues, orb: string): Promise<EncounterCost> => {
  const setup = await resolveGallerySetup({
    ...values,
    room: 'cell',
  }, benchmarkHeight)
  await using gallery = await openHeadlessGallery(setup, benchmarkPage)
  const {page} = gallery
  await fly(page, encounterView.eye, encounterView.look, encounterView.fov)
  await settle(page)
  const steadyFrameMs = await frameTime(page)
  await page.evaluate(() => {
    const probe = {
      frames: [] as Array<number>,
      tasks: [] as Array<[number, number]>,
    }
    Object.assign(globalThis, {orbBenchmark: probe})
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        probe.tasks.push([entry.startTime, entry.duration])
      }
    })
    observer.observe({type: 'longtask'})
    const tick = (time: number) => {
      probe.frames.push(time)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const start = await page.evaluate(() => performance.now())
  await executeWebmcpTool(page, 'spawn_orb', {
    orb,
    position: encounterView.orb,
  })
  let visible: number | undefined
  for (const deadline = Date.now() + 120_000; Date.now() < deadline;) {
    if (isEmpty(await executeWebmcpTool(page, 'get_loading_items'))) {
      visible = await page.evaluate(() => performance.now())
      break
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  if (visible === undefined) {
    throw new Error(`The ${orb} orb was still loading two minutes after it was dropped in.`)
  }
  await new Promise(resolve => setTimeout(resolve, 1000))
  const {frames, tasks} = await page.evaluate(() => (globalThis as unknown as {orbBenchmark: {
    frames: Array<number>
    tasks: Array<[number, number]>
  }}).orbBenchmark)
  const until = visible + 500
  const intervals = frames.slice(1).map((time, index) => [frames[index], time - frames[index]] as const).filter(([at]) => at >= start && at <= until)
  return {
    freezeMs: Math.max(0, ...tasks.filter(([at]) => at >= start && at <= until).map(([, duration]) => duration)),
    worstFrameMs: Math.max(...intervals.map(([, interval]) => interval)),
    steadyFrameMs,
    visibleMs: visible - start,
  }
}
const measureRender = async (values: BenchmarkOrbValues, orb: string): Promise<RenderCost> => {
  const setup = await resolveGallerySetup({
    ...values,
    room: 'cell',
  }, benchmarkHeight)
  const propId = `prop-orb-${orb}`
  setup.search.set('item', propId)
  await using gallery = await openHeadlessGallery(setup, benchmarkPage)
  const {page} = gallery
  const props = await page.evaluate(() => (globalThis.slopGallery!.snapshot!() as unknown as {props: Array<{
    id: string
    position: {
      x: number
      y: number
      z: number
    }
  }>}).props)
  const prop = props.find(entry => entry.id === propId)
  if (!prop) {
    throw new Error(`${propId} is not on a pedestal of the Cell.`)
  }
  const at = [prop.position.x, prop.position.y, prop.position.z]
  // From the side of the Cell’s rotunda, so its far wall stands behind the orb.
  const out = [-at[0], -13.2 - at[2]]
  const length = Math.hypot(...out)
  const cost = {} as RenderCost
  for (const [name, [distance, fov]] of Object.entries(renderViews) as Array<[keyof RenderCost, readonly [number, number]]>) {
    await fly(page, [at[0] + out[0] / length * distance, at[1] + 0.15, at[2] + out[1] / length * distance], at, fov)
    await settle(page)
    cost[name] = await frameTime(page)
  }
  return cost
}

export default async function benchmarkOrb(given: BenchmarkOrbOptions) {
  const values = {
    ...defaults,
    ...normalizeOptions<BenchmarkOrbValues>(given, benchmarkOrbOptions),
  } as BenchmarkOrbValues
  const measured = [values.orb ?? []].flat().flatMap(orb => orb.split(',')).map(orb => orb.trim()).filter(Boolean)
  if (measured.length === 0) {
    throw new Error('--orb names the orb to measure, like --orb impasto.')
  }
  const orbs = [...new Set([values.baseline, ...measured])]
  for (const orb of orbs) {
    await findOrbModule(orb)
  }
  const repeats = Number(values.repeats)
  if (!Number.isSafeInteger(repeats) || repeats < 1) {
    throw new Error(`--repeats must be a whole number from 1 up, got “${values.repeats}”.`)
  }
  const selected = values.phases.split(',').map(phase => phase.trim())
  const unknown = selected.filter(phase => !(phases as ReadonlyArray<string>).includes(phase))
  if (unknown.length > 0) {
    throw new Error(`--phases takes ${phases.join(', ')}, not ${unknown.join(', ')}.`)
  }
  warnAboutDevServer(await resolveGallerySetup(values, benchmarkHeight))
  const costs: Record<string, OrbCost> = Object.fromEntries(orbs.map(orb => [orb, {orb}]))
  if (selected.includes('startup')) {
    console.error('Measuring startup')
    for (const [orb, milliseconds] of Object.entries(await measureStartup(orbs))) {
      costs[orb].startupMs = round(milliseconds)
    }
  }
  for (const phase of ['encounter', 'render'] as const satisfies ReadonlyArray<Phase>) {
    if (!selected.includes(phase)) {
      continue
    }
    const runs: Record<string, Array<EncounterCost | RenderCost>> = Object.fromEntries(orbs.map(orb => [orb, []]))
    for (let repeat = 0; repeat < repeats; repeat++) {
      for (const orb of repeat % 2 ? orbs.toReversed() : orbs) {
        console.error(`Measuring ${phase} of ${orb} (${repeat + 1}/${repeats})`)
        runs[orb].push(await (phase === 'encounter' ? measureEncounter : measureRender)(values, orb))
      }
    }
    for (const orb of orbs) {
      const keys = Object.keys(runs[orb][0]) as Array<keyof EncounterCost & keyof RenderCost>
      const medians = Object.fromEntries(keys.map(key => [key, median(runs[orb].map(run => run[key]))]))
      costs[orb][phase] = Object.fromEntries(keys.map(key => [key, round(medians[key])])) as never
    }
  }
  // The baseline keeps its whole startup and frame time, the others what they add to it.
  const {render: baselineRender, startupMs: baselineStartup} = costs[values.baseline]
  const others = measured.filter(orb => orb !== values.baseline)
  for (const orb of others) {
    const cost = costs[orb]
    if (baselineStartup !== undefined) {
      cost.startupMs = round(cost.startupMs! - baselineStartup)
    }
    if (baselineRender) {
      for (const key of Object.keys(baselineRender) as Array<keyof RenderCost>) {
        cost.render![key] = round(cost.render![key] - baselineRender[key])
      }
    }
  }
  return {
    baseline: values.baseline,
    graphics: values.graphics,
    orbs: orbs.map(orb => costs[orb]),
  }
}

/** a value of the table with its unit, signed for what an orb adds to the baseline, or a dash where it wasn’t measured */
const cell = (value: number | undefined, unit: string, sign = false) => (value === undefined ? '–' : `${sign && value >= 0 ? '+' : ''}${value} ${unit}`)

/** A markdown table of what `benchmarkOrb` resolved with. */
export const costTable = ({baseline, orbs}: Awaited<ReturnType<typeof benchmarkOrb>>) => {
  const rows = orbs.map(({orb, startupMs, encounter, render}) => {
    const isBaseline = orb === baseline
    return `| ${orb}${isBaseline ? ' (baseline)' : ''} | ${cell(startupMs, 'ms', !isBaseline)} | ${encounter ? (encounter.freezeMs > 0 ? `${encounter.freezeMs} ms` : 'none') : '–'} | ${cell(encounter?.worstFrameMs, 'ms')} | ${cell(encounter && round(encounter.visibleMs / 1000), 's')} | ${cell(render?.close, 'ms', !isBaseline)} | ${cell(render?.far, 'ms', !isBaseline)} |`
  })
  return ['| orb | startup | encounter: freeze | worst frame | visible after | render: close | far |', '|---|---|---|---|---|---|---|', ...rows].join('\n')
}

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...benchmarkOrbOptions,
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    if (!['json', 'markdown'].includes(values.format)) {
      throw new Error(`--format must be json or markdown, got “${values.format}”.`)
    }
    const result = await benchmarkOrb(values)
    console.log(values.format === 'markdown' ? costTable(result) : JSON.stringify(result, null, 2))
  }
}
