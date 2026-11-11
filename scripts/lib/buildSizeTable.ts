import type {BuildSize, BuildSizes} from './measureBuildSize.ts'

import Deltable from 'deltable'

/** the categories of the table’s rows in their order, by the kinds of files they hold; other holds every kind none of them names */
export const categories = {
  HTML: ['html', 'htm'],
  scripts: ['js', 'mjs', 'cjs', 'wasm'],
  images: ['jxl', 'svg', 'avif', 'webp', 'png', 'jpg', 'jpeg', 'gif', 'ico'],
  audio: ['opus', 'ogg', 'oga', 'mp3', 'm4a', 'aac', 'flac', 'wav', 'weba'],
  video: ['webm', 'mp4', 'm4v', 'mkv', 'mov', 'ogv'],
  styles: ['css'],
  fonts: ['woff2', 'woff', 'ttf', 'otf'],
  text: ['txt', 'md'],
  data: ['json', 'yaml', 'yml', 'toml', 'msgpack', 'cbor'],
  Cloudflare: ['_headers', '_redirects'],
  other: [],
} satisfies Record<string, ReadonlyArray<string>>
export type Category = keyof typeof categories

const categoryByKind = new Map(Object.entries(categories).flatMap(([category, kinds]) => kinds.map(kind => [kind, category as Category] as const)))
/** the category of a kind of file */
export const categoryOf = (kind: string): Category => categoryByKind.get(kind) ?? 'other'
const deltable = new Deltable({
  idHeaderTitle: 'kind',
  headers: {
    files: 'files',
    bytes: 'bytes',
  },
  total: true,
})
/** the sizes summed up by category */
const byCategory = (sizes: BuildSizes = {}) => {
  const summed: Partial<Record<Category, BuildSize>> = {}
  for (const [kind, size] of Object.entries(sizes)) {
    const category = categoryOf(kind)
    summed[category] ??= {
      files: 0,
      bytes: 0,
    }
    summed[category].files += size.files
    summed[category].bytes += size.bytes
  }
  return summed
}

/** a table of the files and bytes of every category of files in the build or the base revision, in the order of the categories, closed by their totals, and given the sizes of a base revision, how they changed since */
export default function buildSizeTable(sizes: BuildSizes, base?: BuildSizes) {
  const values = byCategory(sizes)
  const baseValues = base && byCategory(base)
  const shown = (Object.keys(categories) as Array<Category>).filter(category => values[category] ?? baseValues?.[category])
  return [
    deltable.render({
      // Categories gone since count 0 in their place, instead of following the others.
      values: Object.fromEntries(shown.map(category => [category, values[category] ?? {
        files: 0,
        bytes: 0,
      }])),
      ...baseValues ? {base: baseValues} : {},
    }),
    '',
  ].join('\n')
}
