import type {BuildSizes} from './measureBuildSize.ts'

import Deltable from 'deltable'

const deltable = new Deltable({
  idHeaderTitle: 'kind',
  headers: {
    files: 'files',
    bytes: 'bytes',
  },
  total: true,
})

/** a table of the files and bytes of every kind of file in the build, closed by their totals, and given the sizes of a base revision, how they changed since */
export default function buildSizeTable(sizes: BuildSizes, base?: BuildSizes) {
  return [
    '## Build size',
    '',
    deltable.render({
      values: sizes,
      ...base ? {base} : {},
    }),
    '',
    'Every file of the production build by its extension, or the name of one without, like _headers, the kinds with the most bytes first. Bytes are those of the files as the build writes them, before the compression the server applies.',
    '',
  ].join('\n')
}
