import type {CodeSizes} from './measureCodeSize.ts'

import Deltable from 'deltable'

import {groups} from './measureCodeSize.ts'

const deltable = new Deltable({
  idHeaderTitle: 'group',
  headers: {
    files: 'files',
    raw: 'raw bytes',
    effective: 'effective bytes',
  },
  total: true,
})
/** every group’s sizes in the table’s order, whatever order they come in */
const rows = (sizes: Partial<CodeSizes>) => Object.fromEntries(groups.map(group => [group, sizes[group]]))

/** a table of every group’s files, raw bytes and effective bytes, closed by their totals, and given the sizes of a base revision, how they changed since */
export default function codeSizeTable(sizes: CodeSizes, base?: Partial<CodeSizes>) {
  return [
    '## code size',
    '',
    deltable.render({
      values: rows(sizes),
      ...base ? {base: rows(base)} : {},
    }),
    '',
  ].join('\n')
}
