import type {CodeSize, CodeSizes} from './measureCodeSize.ts'

import Deltable from 'deltable'

import {extensions, groups} from './measureCodeSize.ts'

const deltable = new Deltable({
  idHeaderTitle: 'group',
  headers: {
    raw: 'raw bytes',
    effective: 'effective bytes',
  },
  total: true,
})
/** every group’s counts in the table’s order, whatever order the sizes come in */
const rows = (sizes: Partial<CodeSizes>) => Object.fromEntries(groups.map(group => [group, sizes[group] && {
  files: sizes[group].files,
  raw: sizes[group].raw,
  effective: sizes[group].effective,
} satisfies CodeSize]))

/** a table of every group’s files, raw bytes and effective bytes, closed by their totals, and given the sizes of a base revision, how they changed since */
export default function codeSizeTable(sizes: CodeSizes, base?: Partial<CodeSizes>) {
  return [
    '## Code size',
    '',
    deltable.render({
      values: rows(sizes),
      ...base ? {base: rows(base)} : {},
    }),
    '',
    `Main is the root package, packages every workspace package below it. Source counts their src and lib folders, scripts their scripts folders and tests their test folders, each only with its ${extensions.join(', ')} files. Effective bytes count the code as the JavaScript it runs as, leaving out TypeScript’s notation, comments and the whitespace the code doesn’t need, but compressing and mangling nothing.`,
    '',
  ].join('\n')
}
