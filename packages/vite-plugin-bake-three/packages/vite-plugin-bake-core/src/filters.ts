import type {NodePath} from '@babel/traverse'
import type {Arrayable} from 'type-fest'

import {relative} from 'node:path'

import * as t from '@babel/types'
import {Minimatch} from 'minimatch'

/** Selects whole files: a glob relative to the project root unless absolute, a RegExp or a predicate, the latter two tested against the normalized absolute filename. */
export type FileFilter = ((id: string) => boolean) | RegExp | string
/** Selects candidates by their scope path, a minimatch pattern like `antechamberDomeGeometry` or `Sculpture/**`, in the files `glob` matches. */
export type ScopeFilter = {
  glob: string
  scope: string
}
export type IncludeFilter = FileFilter | ScopeFilter
/** Tests a candidate’s scope path. */
export type ScopeSelection = (scope: string) => boolean

type CompiledFilter = {
  file: (id: string, path: string) => boolean
  scope?: Minimatch
}

/** a module ID or file path with forward slashes, as Vite and the filters compare them */
export const normalizeId = (id: string) => id.replaceAll('\\', '/')
const isAbsolute = (pattern: string) => pattern.startsWith('/') || /^[A-Za-z]:\//u.test(pattern)
const compileGlob = (pattern: string) => {
  if (!pattern) {
    throw new TypeError('An include glob must not be empty.')
  }
  const absolute = isAbsolute(pattern)
  const matcher = new Minimatch(absolute ? pattern : pattern.replace(/^\.\//u, ''), {dot: true})
  return (id: string, path: string) => matcher.match(absolute ? id : path)
}
const compileFilter = (filter: IncludeFilter): CompiledFilter => {
  if (typeof filter === 'string') {
    return {file: compileGlob(filter)}
  }
  if (typeof filter === 'function') {
    return {file: id => filter(id)}
  }
  if (filter instanceof RegExp) {
    return {
      file: id => {
        filter.lastIndex = 0
        return filter.test(id)
      },
    }
  }
  if (typeof filter.glob !== 'string' || typeof filter.scope !== 'string' || !filter.scope) {
    throw new TypeError('A scoped include filter needs a glob and a non-empty scope pattern.')
  }
  return {
    file: compileGlob(filter.glob),
    scope: new Minimatch(filter.scope),
  }
}
const selectAll: ScopeSelection = () => true

/** Which files a pass analyzes and which candidates in them it may replace. Without include filters, every project file and all of its candidates. */
export class Inclusion {
  readonly #filters: Array<CompiledFilter> | undefined
  readonly #root: string

  constructor(include: Arrayable<IncludeFilter> | undefined, root: string) {
    this.#root = normalizeId(root).replace(/\/$/u, '')
    this.#filters = include === undefined ? undefined : (Array.isArray(include) ? include : [include]).map(compileFilter)
  }

  /** The scope test for the candidates of a file, or undefined when the pass leaves the file alone. */
  select(id: string): ScopeSelection | undefined {
    const file = normalizeId(id)
    if (!this.#filters) {
      return file.startsWith(`${this.#root}/`) ? selectAll : undefined
    }
    const path = normalizeId(relative(this.#root, file))
    const scopes: Array<Minimatch> = []
    for (const filter of this.#filters) {
      if (!filter.file(file, path)) {
        continue
      }
      if (!filter.scope) {
        return selectAll
      }
      scopes.push(filter.scope)
    }
    return scopes.length ? scope => scopes.some(pattern => pattern.match(scope)) : undefined
  }
}

const keyName = (key: t.Node, computed = false) => {
  if (computed) {
    return
  }
  if (t.isIdentifier(key)) {
    return key.name
  }
  if (t.isStringLiteral(key) || t.isNumericLiteral(key)) {
    return String(key.value)
  }
  if (t.isPrivateName(key)) {
    return `#${key.id.name}`
  }
}
/** The name a node gives the code inside it, if any. */
const ownName = (path: NodePath) => {
  const {node} = path
  if (t.isObjectMethod(node) || t.isClassMethod(node)) {
    return keyName(node.key, node.computed)
  }
  if (t.isClassPrivateMethod(node)) {
    return keyName(node.key)
  }
  if ((t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) && node.id) {
    return node.id.name
  }
  if (t.isFunction(node) || t.isClass(node)) {
    // Expressions take the name of what they’re assigned to, which the walk visits next.
    return path.parentPath.isExportDefaultDeclaration() ? 'default' : undefined
  }
  if (t.isVariableDeclarator(node)) {
    return t.isIdentifier(node.id) ? node.id.name : undefined
  }
  if (t.isObjectProperty(node) || t.isClassProperty(node) || t.isClassAccessorProperty(node)) {
    return keyName(node.key, node.computed)
  }
  if (t.isClassPrivateProperty(node)) {
    return keyName(node.key)
  }
}
const calleeName = (node: t.Node) => {
  if (!t.isCallExpression(node) && !t.isNewExpression(node)) {
    return
  }
  const {callee} = node
  if (t.isIdentifier(callee)) {
    return callee.name
  }
  if (t.isMemberExpression(callee)) {
    return keyName(callee.property, callee.computed)
  }
}

/**
 * The names around a candidate joined by slashes, outermost first: the functions, classes, methods, properties and variables it sits in, and its own name, which a definition declares and a call takes from its callee.
 * For example, `geometry = new TorusKnotGeometry()` in `class Sculpture` is `Sculpture/geometry/TorusKnotGeometry`, and a parameterless `function domeGeometry()` is `domeGeometry`.
 */
export function scopePath(path: NodePath, withCallee = true) {
  const names: Array<string> = []
  // The path itself first, then its ancestors up to the program.
  for (const current of path.getAncestry()) {
    const name = ownName(current)
    if (name !== undefined) {
      names.unshift(name)
    }
  }
  const callee = withCallee ? calleeName(path.node) : undefined
  if (callee !== undefined) {
    names.push(callee)
  }
  return names.join('/')
}
