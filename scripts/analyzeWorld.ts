import type {WorldAnalysis} from '#src/lib/webmcp/analyzeWorld.ts'

import {parseArgs} from 'node:util'

import {callWebmcpTool, waitForLoadingItems} from 'capture-session/script'

import {worlds} from '#src/worlds/index.ts'

import {galleryHelp, galleryOptions, openHeadlessGallery, resolveGallerySetup} from './lib/headlessGallery.ts'
import worldTables from './lib/worldTables.ts'

const formats = ['json', 'markdown'] as const
const help = `Usage: bun scripts/analyzeWorld.ts [options]

Opens the world in a private headless browser, calls the app’s analyze_world WebMCP tool and prints its result: per room its title, fence, static meshes, items that can be picked up and lights, plus what lies elsewhere and the global lights.
Starts a private Vite dev server (or serves --target); never touches the visible browser. Progress goes to stderr, so stdout can be redirected to a file.

Options:
  --format <format>       json prints the whole analysis, markdown tables of the rooms’ static meshes and items with their triangles and of their lamps and shadows. Default: json
  --base <file>           the json output of a base revision with the same options, which the markdown tables tell the changes since
  --json <file>           also write the whole analysis as json to this file, like for a later --base
${galleryHelp()}
  -h, --help              show this help

Set BROWSER to a Chromium executable with WebGPU support.`
const analyzeWorldOptions = {
  ...galleryOptions,
  format: {
    type: 'string',
    default: 'json',
  },
  base: {type: 'string'},
  json: {type: 'string'},
} as const

/** the command line options without --help, as parsed strings */
export type AnalyzeWorldOptions = ReturnType<typeof parseArgs<{options: typeof analyzeWorldOptions}>>['values']

/** Resolves with the analysis as JSON or as markdown tables, depending on `format`. */
const main = async (options: AnalyzeWorldOptions) => {
  const format = options.format as typeof formats[number]
  if (!formats.includes(format)) {
    throw new Error(`--format must be one of ${formats.join(', ')}, got “${options.format}”.`)
  }
  if (options.base !== undefined && format !== 'markdown') {
    throw new Error('--base only applies to --format markdown.')
  }
  // Read before the long analysis, so a missing file fails at once.
  const base = options.base === undefined ? undefined : await Bun.file(options.base).json() as WorldAnalysis
  const setup = await resolveGallerySetup(options)
  await using gallery = await openHeadlessGallery(setup, {cacheDir: 'node_modules/.vite-analyze-world'})
  // Rooms other than the start room still download and mount after the scene is ready.
  await waitForLoadingItems(gallery.page)
  const analysis = await callWebmcpTool(gallery.page, 'analyze_world') as WorldAnalysis
  const json = JSON.stringify(analysis, null, 2)
  if (options.json !== undefined) {
    await Bun.write(options.json, json)
  }
  return format === 'markdown' ? worldTables(analysis, worlds[setup.world].title, options.graphics, setup.seed, base) : json
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...analyzeWorldOptions,
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    console.log(await main(values))
  }
}
