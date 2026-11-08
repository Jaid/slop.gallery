import * as path from 'forward-slash-path'
import {minifySync, parseSync, transformSync, Visitor} from 'rolldown/utils'
import traverseWorkspace from 'traverse-workspace'

export const scopes = ['main', 'packages'] as const
/** the folders at the top of a package each kind of code lives in */
export const kinds = {
  source: ['src', 'lib'],
  scripts: ['scripts'],
  tests: ['test'],
} as const
export const extensions = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'mts', 'cjs', 'cts'] as const

export type Scope = typeof scopes[number]
export type Kind = keyof typeof kinds
export type Group = `${Scope}/${Kind}`
export type CodeSize = {
  /** bytes of the code without TypeScript’s notation, comments and the whitespace it doesn’t need */
  effective: number
  files: number
  /** bytes of the files as they are */
  raw: number
}
export type CodeSizes = Record<Group, CodeSize>

const kindEntries = Object.entries(kinds) as Array<[Kind, ReadonlyArray<string>]>
export const groups = scopes.flatMap(scope => kindEntries.map(([kind]) => `${scope}/${kind}` as const))
const kindByFolder = new Map(kindEntries.flatMap(([kind, folders]) => folders.map(folder => [folder, kind] as const)))
const codeGlob = new Bun.Glob(`{${kindByFolder.keys().toArray().join(',')}}/**/*.{${extensions.join(',')}}`)
const decoder = new TextDecoder
/** the text a JSX text child stands for, as Babel’s cleanJSXElementLiteralChild reads it: lines trimmed where they meet another line, blank ones dropped and the rest joined by single spaces */
const cleanJsxText = (text: string) => {
  const lines = text.split(/\r\n|\n|\r/)
  if (lines.length === 1) {
    return text
  }
  return lines.map((line, index) => {
    let trimmed = line.replaceAll('\t', ' ')
    if (index > 0) {
      trimmed = trimmed.replace(/^ +/, '')
    }
    if (index < lines.length - 1) {
      trimmed = trimmed.replace(/ +$/, '')
    }
    return trimmed
  }).filter(Boolean).join(' ')
}

/**
 * The code of a JavaScript or TypeScript file as the JavaScript it runs as, without TypeScript’s notation, comments and the whitespace it doesn’t need, nothing compressed or mangled, so it tells how much code there is rather than how small a build of it gets.
 * Types and type-only imports go first, through Rolldown’s Oxc transformer, which leaves JSX alone and writes out what TypeScript turns into code, like parameter properties. Its Oxc minifier then drops comments and whitespace, but keeps JSX text as written, newlines and indentation included, the comments’ containers in JSX as `{}` and the `export {}` the transformer leaves in modules of nothing but types; all three are cleaned up afterwards.
 */
export const effectiveCode = (file: string, source: string) => {
  const transformed = transformSync(file, source, {
    tsconfig: false,
    jsx: 'preserve',
    typescript: {onlyRemoveTypeImports: true},
  })
  if (transformed.errors.length) {
    throw new Error(`Failed to parse ${file}: ${transformed.errors[0].message}`)
  }
  // Not .cjs for .cts, as TypeScript lets those export like modules.
  const javascriptFile = file.replace(/\.[cm]?ts(x?)$/, '.js$1')
  const minified = minifySync(javascriptFile, transformed.code, {
    compress: false,
    mangle: false,
    codegen: {removeWhitespace: true},
  })
  if (minified.errors.length) {
    throw new Error(`Failed to minify ${file}: ${minified.errors[0].message}`)
  }
  const {code} = minified
  const edits: Array<{
    end: number
    start: number
    text: string
  }> = []
  const visitor = new Visitor({
    JSXText: node => {
      const text = code.slice(node.start, node.end)
      const cleaned = cleanJsxText(text)
      if (cleaned !== text) {
        edits.push({
          start: node.start,
          end: node.end,
          text: cleaned,
        })
      }
    },
    JSXExpressionContainer: node => {
      if (node.expression.type === 'JSXEmptyExpression') {
        edits.push({
          start: node.start,
          end: node.end,
          text: '',
        })
      }
    },
    ExportNamedDeclaration: node => {
      if (!node.declaration && !node.source && !node.specifiers.length) {
        edits.push({
          start: node.start,
          end: node.end,
          text: '',
        })
      }
    },
  })
  visitor.visit(parseSync(javascriptFile, code).program)
  let result = ''
  let offset = 0
  for (const edit of edits) {
    result += code.slice(offset, edit.start) + edit.text
    offset = edit.end
  }
  return result + code.slice(offset)
}

/**
 * The raw and effective sizes of the JavaScript and TypeScript files in the workspace at `folder`, by group: main is the root package, packages every workspace package below it at any depth, each counted once even where several packages list it.
 * A package’s files are those in its src and lib (source), scripts (scripts) and test (tests) folders that no package nested inside it claims.
 */
export default async function measureCodeSize(folder: string) {
  const [root, ...descendants] = await Array.fromAsync(traverseWorkspace.async(folder))
  const packageFolders = [root.folder, ...new Set(descendants.map(entry => entry.folder).filter(packageFolder => packageFolder !== root.folder))]
  const sizes = Object.fromEntries(groups.map(group => [group, {
    files: 0,
    raw: 0,
    effective: 0,
  }])) as CodeSizes
  for (const packageFolder of packageFolders) {
    const scope: Scope = packageFolder === root.folder ? 'main' : 'packages'
    const nestedFolders = packageFolders.filter(other => other.startsWith(`${packageFolder}/`))
    for await (const match of codeGlob.scan({cwd: packageFolder})) {
      const relative = path.normalize(match)
      const file = path.join(packageFolder, relative)
      const segments = relative.split('/')
      if (segments.includes('node_modules') || nestedFolders.some(nestedFolder => file.startsWith(`${nestedFolder}/`))) {
        continue
      }
      const bytes = await Bun.file(file).bytes()
      const size = sizes[`${scope}/${kindByFolder.get(segments[0])!}`]
      size.files++
      size.raw += bytes.byteLength
      size.effective += Buffer.byteLength(effectiveCode(path.relative(root.folder, file), decoder.decode(bytes)))
    }
  }
  return sizes
}
