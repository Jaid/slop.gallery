import {expect, test} from 'bun:test'

import countTable, {formatDelta} from '../../scripts/lib/countTable.ts'

const headers = ['Room', 'Triangles', 'Meshes']
test('without a base revision or without any change, the table stays markdown, closed by its totals', () => {
  const markdown = [
    '| Room | Triangles | Meshes |',
    '| --- | --: | --: |',
    '| Hall | 12\u{202F}000 | 2 |',
    '| **Total** | 12\u{202F}000 | 2 |',
  ].join('\n')
  expect(countTable(headers, [{
    title: 'Hall',
    values: [12_000, 2],
  }])).toBe(markdown)
  expect(countTable(headers, [{
    title: 'Hall',
    values: [12_000, 2],
    base: [12_000, 2],
  }])).toBe(markdown)
})
test('only the columns with a change split into Count and Delta, and the table turns HTML for it', () => {
  const html = countTable(headers, [
    {
      title: 'Hall',
      values: [12_000, 2],
      base: [2000, 2],
    },
    {
      title: 'Nook & Cranny',
      values: [0, 0],
      base: [30_000, 0],
    },
  ])
  expect(html).toBe([
    '<table>',
    '<thead>',
    '<tr><th rowspan="2" align="left">Room</th><th colspan="2">Triangles</th><th rowspan="2" align="right">Meshes</th></tr>',
    '<tr><th align="right">Count</th><th align="right">Delta</th></tr>',
    '</thead>',
    '<tbody>',
    '<tr><td>Hall</td><td align="right">12\u{202F}000</td><td align="right">+10\u{202F}000</td><td align="right">2</td></tr>',
    '<tr><td>Nook &amp; Cranny</td><td align="right">0</td><td align="right">−30\u{202F}000</td><td align="right">0</td></tr>',
    '<tr><td><b>Total</b></td><td align="right">12\u{202F}000</td><td align="right">−20\u{202F}000</td><td align="right">2</td></tr>',
    '</tbody>',
    '</table>',
  ].join('\n'))
})
test('every changed column gets its own pair of subcolumns', () => {
  const html = countTable(headers, [{
    title: 'Hall',
    values: [10, 3],
    base: [12, 2],
  }])
  expect(html).toContain('<tr><th rowspan="2" align="left">Room</th><th colspan="2">Triangles</th><th colspan="2">Meshes</th></tr>')
  expect(html).toContain('<tr><th align="right">Count</th><th align="right">Delta</th><th align="right">Count</th><th align="right">Delta</th></tr>')
  expect(html).toContain('<tr><td>Hall</td><td align="right">10</td><td align="right">−2</td><td align="right">3</td><td align="right">+1</td></tr>')
})
test('deltas carry their sign, a real minus and ±0 for none', () => {
  expect([formatDelta(0), formatDelta(5), formatDelta(-5), formatDelta(-12_345)]).toEqual(['±0', '+5', '−5', '−12\u{202F}345'])
})
