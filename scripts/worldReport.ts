import type {WorldAnalysis} from '#src/lib/webmcp/analyzeWorld.ts'

import {parseArgs} from 'node:util'

import worldTables from './lib/worldTables.ts'

const help = `Usage: bun scripts/worldReport.ts [options] <analysis>...

Prints markdown tables of the static meshes, items and lights of the rooms of the analyses that analyzeWorld.ts wrote as json, one row per room as if they were of one world, with Elsewhere and Global summing up those of every analysis.

Options:
  --base <file>           the json output of analyzeWorld.ts for a base revision, which the tables tell the changes since; repeated for each analysis
  -h, --help              show this help`
/** Resolves with the tables of the analyses, given their files. */
const main = async (files: ReadonlyArray<string>, baseFiles: ReadonlyArray<string> = []) => {
  if (!files.length) {
    throw new Error('Name at least one analysis.')
  }
  const read = (list: ReadonlyArray<string>) => Promise.all(list.map(file => Bun.file(file).json() as Promise<WorldAnalysis>))
  const [analyses, bases] = await Promise.all([read(files), read(baseFiles)])
  return worldTables(analyses, baseFiles.length ? bases : undefined)
}

export default main

if (import.meta.main) {
  const {positionals, values} = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      base: {
        type: 'string',
        multiple: true,
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
    console.log(await main(positionals, values.base))
  }
}
