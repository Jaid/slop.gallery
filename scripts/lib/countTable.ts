export type CountRow = {
  /** the counts in the base revision, 0 where the row didn’t exist there; left out when there is no base revision to compare with */
  base?: Array<number>
  title: string
  values: Array<number>
}

/** counts of 10 000 and more split their thousands by narrow no-break spaces */
export const formatCount = (count: number) => (count < 10_000 ? String(count) : count.toLocaleString('en-US').replaceAll(',', '\u{202F}'))
/** a change of a count, signed with a real minus and ±0 for none */
export const formatDelta = (delta: number) => {
  if (delta === 0) {
    return '±0'
  }
  return `${delta > 0 ? '+' : '−'}${formatCount(Math.abs(delta))}`
}
const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const cell = (text: string) => `<td align="right">${text}</td>`

/**
 * A table of the rows, closed by their totals, the first header naming the rows and the others the columns of counts.
 * Compared with a base revision, every column with any count that changed splits into a Count and a Delta column under its header. Markdown has no cells spanning columns, so such a table comes as HTML, which GitHub renders in comments and job summaries alike; one without any change stays markdown.
 */
export default function countTable(headers: ReadonlyArray<string>, rows: ReadonlyArray<CountRow>) {
  const columns = headers.slice(1)
  const compared = rows.some(row => row.base)
  const total: CountRow = {
    title: 'Total',
    values: columns.map((_, index) => sum(rows.map(row => row.values[index]))),
    ...compared ? {base: columns.map((_, index) => sum(rows.map(row => row.base?.[index] ?? 0)))} : {},
  }
  const all = [...rows, total]
  const changed = columns.map((_, index) => compared && all.some(row => row.values[index] !== (row.base?.[index] ?? 0)))
  if (!changed.includes(true)) {
    return [
      `| ${headers.join(' | ')} |`,
      `| --- |${' --: |'.repeat(columns.length)}`,
      ...all.map(row => `| ${row === total ? '**Total**' : row.title} | ${row.values.map(formatCount).join(' | ')} |`),
    ].join('\n')
  }
  const bodyRow = (row: CountRow) => {
    const title = row === total ? '<b>Total</b>' : escapeHtml(row.title)
    const counts = row.values.map((value, index) => (changed[index] ? cell(formatCount(value)) + cell(formatDelta(value - (row.base?.[index] ?? 0))) : cell(formatCount(value))))
    return `<tr><td>${title}</td>${counts.join('')}</tr>`
  }
  return [
    '<table>',
    '<thead>',
    `<tr><th rowspan="2" align="left">${escapeHtml(headers[0])}</th>${columns.map((header, index) => (changed[index] ? `<th colspan="2">${escapeHtml(header)}</th>` : `<th rowspan="2" align="right">${escapeHtml(header)}</th>`)).join('')}</tr>`,
    `<tr>${'<th align="right">Count</th><th align="right">Delta</th>'.repeat(changed.filter(Boolean).length)}</tr>`,
    '</thead>',
    '<tbody>',
    ...all.map(bodyRow),
    '</tbody>',
    '</table>',
  ].join('\n')
}
