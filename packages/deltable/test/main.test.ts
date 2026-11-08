import {describe, expect, test} from 'bun:test'

import Deltable, {formatCount, formatDelta} from '../src/main.ts'

const deltable = new Deltable({
  idHeaderTitle: 'room',
  total: true,
})
describe('markdown', () => {
  test('without a base or without any change, the table stays markdown, closed by its totals', () => {
    const markdown = [
      '| room | triangles | meshes |',
      '| --- | --: | --: |',
      '| Hall | 12\u{202F}000 | 2 |',
      '| **total** | 12\u{202F}000 | 2 |',
    ].join('\n')
    const values = {
      Hall: {
        triangles: 12_000,
        meshes: 2,
      },
    }
    expect(deltable.render({values})).toBe(markdown)
    expect(deltable.render({
      values,
      base: structuredClone(values),
    })).toBe(markdown)
  })
  test('by default, the ID header is empty, columns are titled by their keys and no totals close the table', () => {
    const defaults = new Deltable
    expect(defaults.render({
      values: {
        a: {files: 1},
        b: {files: 2},
      },
    })).toBe(['|  | files |', '| --- | --: |', '| a | 1 |', '| b | 2 |'].join('\n'))
  })
  test('counts of 0 leave their cells empty unless zeroValue says otherwise', () => {
    const values = {
      a: {
        files: 0,
        bytes: 5,
      },
    }
    expect(deltable.render({values})).toBe(['| room | files | bytes |', '| --- | --: | --: |', '| a |  | 5 |', '| **total** |  | 5 |'].join('\n'))
    const dashed = new Deltable({zeroValue: '–'})
    expect(dashed.render({values})).toBe(['|  | files | bytes |', '| --- | --: | --: |', '| a | – | 5 |'].join('\n'))
  })
  test('the titles of the subcolumns and the totals can be set', () => {
    const titled = new Deltable({
      valueHeaderTitle: 'now',
      deltaHeaderTitle: 'change',
      total: true,
      totalTitle: 'sum',
    })
    const html = titled.render({
      values: {a: {files: 2}},
      base: {a: {files: 1}},
    })
    expect(html).toContain('<tr><th align="right">now</th><th align="right">change</th></tr>')
    expect(html).toContain('<tr><td><b>sum</b></td><td align="right">2</td><td align="right">+1</td></tr>')
  })
  test('columns follow the order of headers, even without counts, and the others come after them in the order they first appear', () => {
    const ordered = new Deltable({
      headers: {
        files: 'files',
        bytes: 'bytes',
        lines: 'lines',
      },
    })
    expect(ordered.render({
      values: {
        a: {
          words: 3,
          bytes: 20,
        },
        b: {
          files: 1,
          chars: 9,
        },
      },
    })).toBe(['|  | files | bytes | lines | words | chars |', '| --- | --: | --: | --: | --: | --: |', '| a |  | 20 |  | 3 |  |', '| b | 1 |  |  |  | 9 |'].join('\n'))
  })
  test('pipes in titles and IDs are escaped', () => {
    const piped = new Deltable({headers: {count: 'this | that'}})
    expect(piped.render({values: {'a|b': {count: 1}}})).toBe([String.raw`|  | this \| that |`, '| --- | --: |', String.raw`| a\|b | 1 |`].join('\n'))
  })
})
describe('html', () => {
  test('only the columns with a change split into Count and Delta, and the table turns HTML for it', () => {
    expect(deltable.render({
      values: {
        Hall: {
          triangles: 12_000,
          meshes: 2,
        },
        'Nook & Cranny': {
          triangles: 0,
          meshes: 0,
        },
      },
      base: {
        Hall: {
          triangles: 2000,
          meshes: 2,
        },
        'Nook & Cranny': {
          triangles: 30_000,
          meshes: 0,
        },
      },
    })).toBe([
      '<table>',
      '<thead>',
      '<tr><th rowspan="2" align="left">room</th><th colspan="2">triangles</th><th rowspan="2" align="right">meshes</th></tr>',
      '<tr><th align="right">count</th><th align="right">delta</th></tr>',
      '</thead>',
      '<tbody>',
      '<tr><td>Hall</td><td align="right">12\u{202F}000</td><td align="right">+10\u{202F}000</td><td align="right">2</td></tr>',
      '<tr><td>Nook &amp; Cranny</td><td align="right"></td><td align="right">−30\u{202F}000</td><td align="right"></td></tr>',
      '<tr><td><b>total</b></td><td align="right">12\u{202F}000</td><td align="right">−20\u{202F}000</td><td align="right">2</td></tr>',
      '</tbody>',
      '</table>',
    ].join('\n'))
  })
  test('every changed column gets its own pair of subcolumns, with unchanged counts leaving the delta empty', () => {
    const html = deltable.render({
      values: {
        Hall: {
          triangles: 10,
          meshes: 3,
        },
        Salon: {
          triangles: 5,
          meshes: 1,
        },
      },
      base: {
        Hall: {
          triangles: 12,
          meshes: 2,
        },
        Salon: {
          triangles: 5,
          meshes: 1,
        },
      },
    })
    expect(html).toContain('<tr><th rowspan="2" align="left">room</th><th colspan="2">triangles</th><th colspan="2">meshes</th></tr>')
    expect(html).toContain('<tr><th align="right">count</th><th align="right">delta</th><th align="right">count</th><th align="right">delta</th></tr>')
    expect(html).toContain('<tr><td>Hall</td><td align="right">10</td><td align="right">−2</td><td align="right">3</td><td align="right">+1</td></tr>')
    expect(html).toContain('<tr><td>Salon</td><td align="right">5</td><td align="right"></td><td align="right">1</td><td align="right"></td></tr>')
  })
  test('rows and counts only the base has count 0, and come after the others', () => {
    const html = deltable.render({
      values: {Hall: {triangles: 10}},
      base: {
        Parlor: {
          triangles: 4,
          meshes: 1,
        },
        Hall: {triangles: 10},
      },
    })
    expect(html).toContain('<th colspan="2">triangles</th><th colspan="2">meshes</th>')
    expect(html).toContain('<tr><td>Hall</td><td align="right">10</td><td align="right"></td><td align="right"></td><td align="right"></td></tr>\n<tr><td>Parlor</td><td align="right"></td><td align="right">−4</td><td align="right"></td><td align="right">−1</td></tr>')
    expect(html).toContain('<tr><td><b>total</b></td><td align="right">10</td><td align="right">−4</td><td align="right"></td><td align="right">−1</td></tr>')
  })
})
describe('format', () => {
  test('counts split their thousands from 10 000 on and carry a real minus', () => {
    expect([formatCount(0), formatCount(9999), formatCount(65_536), formatCount(-1_234_567), formatCount(49_174.4193)]).toEqual(['0', '9999', '65\u{202F}536', '−1\u{202F}234\u{202F}567', '49\u{202F}174.4193'])
  })
  test('deltas carry their sign, a real minus and nothing for none', () => {
    expect([formatDelta(0), formatDelta(5), formatDelta(-5), formatDelta(-12_345)]).toEqual(['', '+5', '−5', '−12\u{202F}345'])
  })
})
