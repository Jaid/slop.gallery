import type {BuildSizes} from './lib/measureBuildSize.ts'

import {parseArgs} from 'node:util'

import * as path from 'forward-slash-path'

import buildSizeTable from './lib/buildSizeTable.ts'
import measureBuildSize from './lib/measureBuildSize.ts'

const formats = ['json', 'markdown'] as const
const help = `Usage: bun scripts/buildSize.ts [options]

Prints the size of the production build by the kinds of its files, their extensions or the names of those without one, with their files and bytes, the kinds with the most bytes first, or as a table, by categories of them like scripts and images.
Bytes are those of the files as the build writes them, before the compression the server applies.

Options:
  --folder <folder>       the build. Default: this repository’s dist, which bun run build writes
  --format <format>       json prints the sizes by kind, markdown a table of them by category closed by their totals. Default: json
  --base <file>           the json output of a base revision, which the markdown table tells the changes since
  -h, --help              show this help`
const buildSizeOptions = {
  folder: {type: 'string'},
  format: {type: 'string'},
  base: {type: 'string'},
} as const

/** the command line options without --help, as parsed strings */
export type BuildSizeOptions = ReturnType<typeof parseArgs<{options: typeof buildSizeOptions}>>['values']

/** Resolves with the sizes as JSON or as a markdown table, depending on `format`. */
const main = async ({folder = path.resolve(import.meta.dir, '../dist'), format = 'json', base}: BuildSizeOptions = {}) => {
  if (!formats.includes(format as typeof formats[number])) {
    throw new Error(`--format must be one of ${formats.join(', ')}, got “${format}”.`)
  }
  if (base !== undefined && format !== 'markdown') {
    throw new Error('--base only applies to --format markdown.')
  }
  const baseSizes = base === undefined ? undefined : await Bun.file(base).json() as BuildSizes
  const sizes = await measureBuildSize(folder)
  return format === 'markdown' ? buildSizeTable(sizes, baseSizes) : JSON.stringify(sizes, null, 2)
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...buildSizeOptions,
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
