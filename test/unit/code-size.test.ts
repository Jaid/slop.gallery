import type {CodeSizes} from '../../scripts/lib/measureCodeSize.ts'

import {afterEach, expect, test} from 'bun:test'

import * as path from 'forward-slash-path'
import fs from 'fs-extra'

import codeSize from '../../scripts/codeSize.ts'
import codeSizeTable from '../../scripts/lib/codeSizeTable.ts'
import measureCodeSize, {effectiveCode, groups} from '../../scripts/lib/measureCodeSize.ts'

const roots: Array<string> = []
const temporaryRoot = async () => {
  // temp/ is gitignored, so a fresh checkout doesn’t have it yet
  const parent = path.resolve(import.meta.dir, '../../temp')
  await fs.ensureDir(parent)
  const root = await fs.mkdtemp(path.resolve(parent, 'code-size-'))
  roots.push(root)
  return root
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.remove(root)))
})
const manifest = (name: string, workspaces?: Array<string>) => JSON.stringify({
  name,
  ...workspaces ? {workspaces} : {},
})
test('effective code leaves out comments and whitespace but keeps types and statement ends', () => {
  const source = [
    '// a comment',
    'import type {A} from \'./a.ts\'',
    '',
    '/** the documented type */',
    'export type Foo = {',
    '  a: A',
    '  b: Array<number> /* inline */',
    '}',
    'const value = 1 as const',
    'foo()',
    ';[value].forEach(item => item satisfies number)',
    '',
  ].join('\n')
  expect(effectiveCode('example.ts', source)).toBe('import type{A}from"./a.ts";export type Foo={a:A;b:Array<number>;};const value=1 as const;foo();[value].forEach(item=>item satisfies number);')
})
test('effective code folds JSX text as JSX reads it and drops JSX comments', () => {
  const source = [
    'export const Card = () => (',
    '  <div>',
    '    {/* a comment */}',
    '    <b>bold</b> <i>  italic  </i>',
    '    <span>',
    '      two',
    '      lines',
    '    </span>',
    '  </div>',
    ')',
    '',
  ].join('\n')
  expect(effectiveCode('Card.tsx', source)).toBe('export const Card=()=><div><b>bold</b> <i>  italic  </i><span>two lines</span></div>;')
})
test('effective code refuses files it can’t parse', () => {
  expect(() => effectiveCode('broken.ts', 'const = 1')).toThrow('Failed to parse broken.ts')
})
test('groups split the root package from every workspace package below it, each once, by the folder their files lie in', async () => {
  const root = await temporaryRoot()
  const write = async (file: string, content: string) => fs.outputFile(path.join(root, file), content)
  const code = '// comment\nexport const a = 1\n'
  const button = 'export default () => <button>\n  Go\n</button>\n'
  await write('package.json', manifest('root', ['packages/*', 'packages/outer/packages/*']))
  await write('src/main.ts', code)
  await write('src/components/Button/index.tsx', button)
  await write('lib/helper.js', code)
  await write('scripts/build.ts', code)
  await write('test/main.test.ts', code)
  // Neither in a counted folder nor of a counted type.
  await write('vite.config.ts', code)
  await write('src/readme.md', '# Readme\n')
  await write('src/node_modules/dependency/index.js', code)
  // Listed by the root and by outer, so counted once.
  await write('packages/outer/package.json', manifest('outer', ['packages/*']))
  await write('packages/outer/src/main.mts', code)
  await write('packages/outer/packages/inner/package.json', manifest('inner'))
  await write('packages/outer/packages/inner/test/inner.test.cts', code)
  await write('packages/outer/packages/inner/scripts/run.jsx', code)
  // A package declared inside another one’s source belongs to itself alone.
  await write('packages/embedded/package.json', manifest('embedded', ['src/vendored']))
  await write('packages/embedded/src/main.ts', code)
  await write('packages/embedded/src/vendored/package.json', manifest('vendored'))
  await write('packages/embedded/src/vendored/test/vendored.test.ts', code)
  /** the size of that many files of `code` */
  const plain = (files: number) => ({
    files,
    raw: files * Buffer.byteLength(code),
    effective: files * Buffer.byteLength('export const a=1;'),
  })
  expect(await measureCodeSize(root)).toEqual({
    'main/source': {
      files: 3,
      raw: plain(2).raw + Buffer.byteLength(button),
      effective: plain(2).effective + Buffer.byteLength('export default()=><button>Go</button>;'),
    },
    'main/scripts': plain(1),
    'main/tests': plain(1),
    'packages/source': plain(2),
    'packages/scripts': plain(1),
    'packages/tests': plain(2),
  } satisfies CodeSizes)
})
test('the table lists every group in a fixed order with narrow-spaced thousands and closes with their totals', () => {
  const sizes = Object.fromEntries(groups.map((group, index) => [group, {
    files: index + 1,
    raw: 10_000 * (index + 1),
    effective: 6000 * (index + 1),
  }])) as CodeSizes
  const markdown = codeSizeTable(sizes)
  expect(markdown).toStartWith('## Code size\n')
  expect(markdown).toContain([
    '| Group | Files | Raw bytes | Effective bytes |',
    '| --- | --: | --: | --: |',
    '| main/source | 1 | 10\u{202F}000 | 6000 |',
    '| main/scripts | 2 | 20\u{202F}000 | 12\u{202F}000 |',
    '| main/tests | 3 | 30\u{202F}000 | 18\u{202F}000 |',
    '| packages/source | 4 | 40\u{202F}000 | 24\u{202F}000 |',
    '| packages/scripts | 5 | 50\u{202F}000 | 30\u{202F}000 |',
    '| packages/tests | 6 | 60\u{202F}000 | 36\u{202F}000 |',
    '| **Total** | 21 | 210\u{202F}000 | 126\u{202F}000 |',
  ].join('\n'))
})
test('the script refuses unknown formats', async () => {
  await expect(codeSize({format: 'yaml'})).rejects.toThrow('--format must be one of json, markdown')
})
