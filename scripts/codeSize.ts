import type {CodeSizes} from './lib/measureCodeSize.ts'

import {parseArgs} from 'node:util'

import * as path from 'forward-slash-path'

import codeSizeTable from './lib/codeSizeTable.ts'
import measureCodeSize from './lib/measureCodeSize.ts'

const formats = ['json', 'markdown'] as const
const help = `Usage: bun scripts/codeSize.ts [options]

Prints the code size of the workspace in six groups, main (the root package) and packages (every workspace package below it, at any depth), each split into source (src and lib), scripts (scripts) and tests (test), with their files, raw bytes and effective bytes. Only JavaScript and TypeScript files count.
Effective bytes are those of the code as the JavaScript it runs as, without TypeScript’s notation, comments and the whitespace it doesn’t need, neither compressed nor mangled.

Options:
  --folder <folder>       the workspace root. Default: this repository
  --format <format>       json prints the sizes by group, markdown a table of them closed by their totals. Default: json
  --base <file>           the json output of a base revision, which the markdown table tells the changes since
  -h, --help              show this help`
const codeSizeOptions = {
  folder: {type: 'string'},
  format: {type: 'string'},
  base: {type: 'string'},
} as const

/** the command line options without --help, as parsed strings */
export type CodeSizeOptions = ReturnType<typeof parseArgs<{options: typeof codeSizeOptions}>>['values']

/** Resolves with the sizes as JSON or as a markdown table, depending on `format`. */
const main = async ({folder = path.resolve(import.meta.dir, '..'), format = 'json', base}: CodeSizeOptions = {}) => {
  if (!formats.includes(format as typeof formats[number])) {
    throw new Error(`--format must be one of ${formats.join(', ')}, got “${format}”.`)
  }
  if (base !== undefined && format !== 'markdown') {
    throw new Error('--base only applies to --format markdown.')
  }
  const baseSizes = base === undefined ? undefined : await Bun.file(base).json() as Partial<CodeSizes>
  const sizes = await measureCodeSize(folder)
  return format === 'markdown' ? codeSizeTable(sizes, baseSizes) : JSON.stringify(sizes, null, 2)
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...codeSizeOptions,
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
