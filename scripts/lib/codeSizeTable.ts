import type {CodeSize, CodeSizes} from './measureCodeSize.ts'

import countTable from './countTable.ts'
import {extensions, groups} from './measureCodeSize.ts'

const values = (size?: CodeSize) => [size?.files ?? 0, size?.raw ?? 0, size?.effective ?? 0]

/** a table of every group’s files, raw bytes and effective bytes, closed by their totals, and given the sizes of a base revision, how they changed since */
export default function codeSizeTable(sizes: CodeSizes, base?: Partial<CodeSizes>) {
  const rows = groups.map(group => ({
    title: group,
    values: values(sizes[group]),
    ...base ? {base: values(base[group])} : {},
  }))
  return [
    '## Code size',
    '',
    countTable(['Group', 'Files', 'Raw bytes', 'Effective bytes'], rows),
    '',
    `Main is the root package, packages every workspace package below it. Source counts their src and lib folders, scripts their scripts folders and tests their test folders, each only with its ${extensions.join(', ')} files. Effective bytes count the code as the JavaScript it runs as, leaving out TypeScript’s notation, comments and the whitespace the code doesn’t need, but compressing and mangling nothing.`,
    '',
  ].join('\n')
}
