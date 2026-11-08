import {formatCount, formatDelta} from './format.ts'

/** the counts of every row by its ID, and of every row by its column’s key; a missing row or count counts as 0 */
export type DeltableRows = Partial<Record<string, Partial<Record<string, number>>>>

export type DeltableOptions = {
  /** the title of a changed column’s subcolumn with its deltas. Default: delta */
  deltaHeaderTitle?: string
  /** the titles of the columns by their keys; a column without one is titled by its key */
  headers?: Partial<Record<string, string>>
  /** the title of the cell above the row IDs. Default: empty */
  idHeaderTitle?: string
  /** whether a row with the sums of every column closes the table. Default: false */
  total?: boolean
  /** the ID of the row with the sums. Default: total */
  totalTitle?: string
  /** the title of a changed column’s subcolumn with its counts. Default: count */
  valueHeaderTitle?: string
}

export type DeltableInput = {
  /** the rows to compare with, typically from an earlier revision; left out, the table has no deltas */
  base?: DeltableRows
  values: DeltableRows
}

type Row = {
  base: Array<number>
  id: string
  total: boolean
  values: Array<number>
}

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const escapeMarkdown = (text: string) => text.replaceAll('|', String.raw`\|`)
const cell = (text: string) => `<td align="right">${text}</td>`
/** the keys of the defined entries, in their order */
const presentKeys = (record: Partial<Record<string, unknown>> = {}) => Object.keys(record).filter(key => record[key] !== undefined)

/**
 * Renders tables of counts, which compared with a base tell how the counts changed.
 * Every column with a count that changed splits into a count and a delta subcolumn under its title, where unchanged counts leave the delta empty. Markdown has no cells spanning columns, so such a table comes as HTML, which GitHub renders in markdown anyway; a table without any change stays markdown.
 */
export default class Deltable {
  readonly options: Required<DeltableOptions>
  constructor(options: DeltableOptions = {}) {
    this.options = {
      idHeaderTitle: '',
      valueHeaderTitle: 'count',
      deltaHeaderTitle: 'delta',
      headers: {},
      total: false,
      totalTitle: 'total',
      ...options,
    }
  }
  /**
   * The rows of `values` in their order, then those only `base` has with counts of 0; the columns in the order they first appear in them.
   * Rows keep the order of their IDs in the objects, which JavaScript puts first for IDs that are array indices, like “7”.
   */
  render({values, base}: DeltableInput) {
    const ids = [...new Set([...presentKeys(values), ...presentKeys(base)])]
    const keys = [...new Set(ids.flatMap(id => [...presentKeys(values[id]), ...presentKeys(base?.[id])]))]
    const counts = (rows: DeltableRows | undefined, id: string) => keys.map(key => rows?.[id]?.[key] ?? 0)
    const rows: Array<Row> = ids.map(id => ({
      id,
      total: false,
      values: counts(values, id),
      base: counts(base, id),
    }))
    if (this.options.total) {
      rows.push({
        id: this.options.totalTitle,
        total: true,
        values: keys.map((_, index) => sum(rows.map(row => row.values[index]))),
        base: keys.map((_, index) => sum(rows.map(row => row.base[index]))),
      })
    }
    const titles = keys.map(key => this.options.headers[key] ?? key)
    const changed = keys.map((_, index) => base !== undefined && rows.some(row => row.values[index] !== row.base[index]))
    if (!changed.includes(true)) {
      return this.#renderMarkdown(titles, rows)
    }
    return this.#renderHtml(titles, rows, changed)
  }
  #renderHtml(titles: ReadonlyArray<string>, rows: ReadonlyArray<Row>, changed: ReadonlyArray<boolean>) {
    const headers = titles.map((title, index) => (changed[index] ? `<th colspan="2">${escapeHtml(title)}</th>` : `<th rowspan="2" align="right">${escapeHtml(title)}</th>`))
    const subheaders = `<th align="right">${escapeHtml(this.options.valueHeaderTitle)}</th><th align="right">${escapeHtml(this.options.deltaHeaderTitle)}</th>`
    const bodyRow = (row: Row) => {
      const id = row.total ? `<b>${escapeHtml(row.id)}</b>` : escapeHtml(row.id)
      const cells = row.values.map((value, index) => (changed[index] ? cell(formatCount(value)) + cell(formatDelta(value - row.base[index])) : cell(formatCount(value))))
      return `<tr><td>${id}</td>${cells.join('')}</tr>`
    }
    return [
      '<table>',
      '<thead>',
      `<tr><th rowspan="2" align="left">${escapeHtml(this.options.idHeaderTitle)}</th>${headers.join('')}</tr>`,
      `<tr>${subheaders.repeat(changed.filter(Boolean).length)}</tr>`,
      '</thead>',
      '<tbody>',
      ...rows.map(bodyRow),
      '</tbody>',
      '</table>',
    ].join('\n')
  }
  #renderMarkdown(titles: ReadonlyArray<string>, rows: ReadonlyArray<Row>) {
    const line = (cells: ReadonlyArray<string>) => `| ${cells.join(' | ')} |`
    return [
      line([this.options.idHeaderTitle, ...titles].map(escapeMarkdown)),
      `| --- |${' --: |'.repeat(titles.length)}`,
      ...rows.map(row => line([row.total ? `**${escapeMarkdown(row.id)}**` : escapeMarkdown(row.id), ...row.values.map(formatCount)])),
    ].join('\n')
  }
}
