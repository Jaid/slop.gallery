import type {CodeSize, CodeSizes} from './measureCodeSize.ts'

import {extensions, groups} from './measureCodeSize.ts'
import {formatCount} from './worldTables.ts'

const row = (title: string, size: CodeSize) => `| ${title} | ${formatCount(size.files)} | ${formatCount(size.raw)} | ${formatCount(size.effective)} |`

/** a markdown table of every group’s files, raw bytes and effective bytes, closed by their totals */
export default function codeSizeTable(sizes: CodeSizes) {
  const total: CodeSize = {
    files: 0,
    raw: 0,
    effective: 0,
  }
  for (const group of groups) {
    total.files += sizes[group].files
    total.raw += sizes[group].raw
    total.effective += sizes[group].effective
  }
  return [
    '## Code size',
    '',
    '| Group | Files | Raw bytes | Effective bytes |',
    '| --- | --: | --: | --: |',
    ...groups.map(group => row(group, sizes[group])),
    row('**Total**', total),
    '',
    `Main is the root package, packages every workspace package below it. Source counts their src and lib folders, scripts their scripts folders and tests their test folders, each only with its ${extensions.join(', ')} files. Effective bytes count the code as the JavaScript it runs as, leaving out TypeScript’s notation, comments and the whitespace the code doesn’t need, but compressing and mangling nothing.`,
    '',
  ].join('\n')
}
