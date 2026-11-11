import {afterEach, expect, test} from 'bun:test'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'

import buildSize from '../../scripts/buildSize.ts'
import buildSizeTable, {categoryOf} from '../../scripts/lib/buildSizeTable.ts'
import measureBuildSize, {fileKind} from '../../scripts/lib/measureBuildSize.ts'

const folders: Array<string> = []
const temporaryBuild = async (files: Record<string, string>) => {
  // temp/ is gitignored, so a fresh checkout doesn’t have it yet
  const parent = path.resolve(import.meta.dir, '../../temp')
  await fs.ensureDir(parent)
  const folder = await fs.mkdtemp(path.resolve(parent, 'build-size-'))
  folders.push(folder)
  await Promise.all(Object.entries(files).map(([file, text]) => fs.outputFile(path.join(folder, file), text)))
  return folder
}
afterEach(async () => {
  await Promise.all(folders.splice(0).map(folder => fs.remove(folder)))
})
test('files are of the kind of their extension in lowercase, or of their name without one', () => {
  expect(['a1b2c3d4.js', 'ab.Css', 'nested/x.min.JS', '_headers', '.nojekyll', 'index.html'].map(fileKind)).toEqual(['js', 'css', 'js', '_headers', '.nojekyll', 'html'])
})
test('the sizes count every file, nested and hidden ones too, by kind with the most bytes first', async () => {
  const folder = await temporaryBuild({
    'index.html': '<!doctype html>',
    'a.js': 'x'.repeat(100),
    'B.JS': 'x'.repeat(50),
    'nested/c.jxl': 'x'.repeat(120),
    _headers: '/*',
    '.hidden': '',
  })
  const sizes = await measureBuildSize(folder)
  expect(sizes).toEqual({
    js: {
      files: 2,
      bytes: 150,
    },
    jxl: {
      files: 1,
      bytes: 120,
    },
    html: {
      files: 1,
      bytes: 15,
    },
    _headers: {
      files: 1,
      bytes: 2,
    },
    '.hidden': {
      files: 1,
      bytes: 0,
    },
  })
  expect(Object.keys(sizes)).toEqual(['js', 'jxl', 'html', '_headers', '.hidden'])
})
test('every kind of file has a category, other for those none names', () => {
  expect(['html', 'js', 'wasm', 'jxl', 'svg', 'opus', 'webm', 'css', 'woff2', 'ttf', 'txt', 'md', 'json', 'msgpack', 'cbor', '_headers', 'bin', 'glb'].map(categoryOf)).toEqual(['HTML', 'scripts', 'scripts', 'images', 'images', 'audio', 'video', 'styles', 'fonts', 'fonts', 'text', 'text', 'data', 'data', 'data', 'Cloudflare', 'other', 'other'])
})
test('the table sums the kinds up by category in the order of the categories, closed by their totals', () => {
  const markdown = buildSizeTable({
    js: {
      files: 40,
      bytes: 3_000_000,
    },
    bin: {
      files: 2,
      bytes: 500,
    },
    css: {
      files: 1,
      bytes: 9000,
    },
    wasm: {
      files: 1,
      bytes: 1000,
    },
    html: {
      files: 1,
      bytes: 300,
    },
  })
  expect(markdown).toBe([
    '| kind | files | bytes |',
    '| --- | --: | --: |',
    '| HTML | 1 | 300 |',
    '| scripts | 41 | 3\u{202F}001\u{202F}000 |',
    '| styles | 1 | 9000 |',
    '| other | 2 | 500 |',
    '| **total** | 45 | 3\u{202F}010\u{202F}800 |',
    '',
  ].join('\n'))
})
test('the script tells the changes since the json output of a base revision, with categories gone since in their place', async () => {
  const folder = await temporaryBuild({
    'index.html': 'x',
    'a.js': 'x'.repeat(100),
    'b.opus': 'x'.repeat(10),
  })
  const base = path.join(path.dirname(folder), `${path.basename(folder)}.json`)
  folders.push(base)
  await fs.outputFile(base, await buildSize({folder}))
  await fs.remove(path.join(folder, 'b.opus'))
  await fs.outputFile(path.join(folder, 'c.wasm'), 'x'.repeat(5))
  await fs.outputFile(path.join(folder, 'd.css'), 'x'.repeat(5))
  const markdown = await buildSize({
    folder,
    format: 'markdown',
    base,
  })
  expect(markdown).toContain('<tr><th rowspan="2" align="left">kind</th><th colspan="2">files</th><th colspan="2">bytes</th></tr>')
  expect(markdown).toContain([
    '<tr><td>HTML</td><td align="right">1</td><td align="right"></td><td align="right">1</td><td align="right"></td></tr>',
    '<tr><td>scripts</td><td align="right">2</td><td align="right">+1</td><td align="right">105</td><td align="right">+5</td></tr>',
    '<tr><td>audio</td><td align="right"></td><td align="right">−1</td><td align="right"></td><td align="right">−10</td></tr>',
    '<tr><td>styles</td><td align="right">1</td><td align="right">+1</td><td align="right">5</td><td align="right">+5</td></tr>',
    '<tr><td><b>total</b></td><td align="right">4</td><td align="right">+1</td><td align="right">111</td><td align="right"></td></tr>',
  ].join('\n'))
  await expect(buildSize({base})).rejects.toThrow('--base only applies to --format markdown')
})
test('the script refuses unknown formats and missing builds', async () => {
  await expect(buildSize({format: 'yaml'})).rejects.toThrow('--format must be one of json, markdown')
  await expect(buildSize({folder: path.resolve(import.meta.dir, '../../temp/no-such-build')})).rejects.toThrow('There is no build in')
})
