import type SourceGraph from './SourceGraph.ts'
import type {BakeAdapter, SourceModule} from './types.ts'
import type {Binding, NodePath} from '@babel/traverse'

import {Script} from 'node:vm'

import {loadPartialConfigSync, transformFromAstSync} from '@babel/core'
import generate from '@babel/generator'
import transformTypescript from '@babel/plugin-transform-typescript'
import traverse from '@babel/traverse'
import * as t from '@babel/types'

import {guardIdentities, identityAccess} from './identity.ts'
import mathModule from './math.ts'
import ReadOnlyGraph, {protectNative} from './ReadOnlyGraph.ts'
import {assertConstant, importInfo} from './SourceGraph.ts'
import {NotBakeableError} from './types.ts'

const globals = new Set(['undefined', 'NaN', 'Infinity', 'Math', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Map', 'Set', 'ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'Error', 'TypeError', 'RangeError', 'parseInt', 'parseFloat', 'isFinite', 'isNaN'])
/** how many declarations a recipe may pull in from its modules, enough for a recipe over a world assembled from a dozen room modules, while a runaway dependency walk still stops early */
const maxDependencies = 1024
const forbiddenProperties = new Set(['constructor', '__proto__', 'prototype', 'caller', 'callee', 'now', 'getPrototypeOf', 'setPrototypeOf', 'defineProperty', 'defineProperties', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'addEventListener', 'dispatchEvent'])
export type EvaluatedRecipe = {
  code: string
  dependencies: ReadonlySet<string>
  evaluationMs: number
  isShared: (value: object) => boolean
  rootPrototype?: object
  runtimeConstructor?: string
  value: unknown
}
type Slot = {
  name: string
  pending: boolean
}

export function describeExpression(node: t.Node) {
  return generate(node, {
    concise: true,
    comments: false,
  }).code.slice(0, 180)
}
function isType(path: NodePath) {
  return Boolean(path.findParent(parent => parent.isTSType() || parent.isTSTypeAnnotation() || parent.isTSInterfaceDeclaration()))
}
// Resolved once: loading the plugin configuration anew for every rewritten declaration took about a third of a build.
const eraseOptions = loadPartialConfigSync({
  filename: 'recipe.ts',
  babelrc: false,
  configFile: false,
  plugins: [transformTypescript],
  ast: true,
  code: false,
  // Every caller passes a fresh AST.
  cloneInputAst: false,
})!.options
/** Babel scopes don’t bind parameter properties and take type alias names for references, so references are collected from plain JavaScript. */
function eraseTypes(file: t.File) {
  return transformFromAstSync(file, '', eraseOptions)!.ast!
}
/** Reject capabilities that cannot be made invariant. This is an optimizer, not an untrusted-code sandbox. */
function validate(path: NodePath, allowFreezingRandomness: boolean) {
  if (isType(path)) {
    return
  }
  if (path.isMetaProperty() || path.isImportExpression() || path.isAwaitExpression() || path.isYieldExpression() || path.isJSXElement() || path.isJSXFragment() || path.isPrivateName() || path.isTaggedTemplateExpression() || path.isSuper()) {
    // Ordinary super() is supported for resource subclasses; reflective super.property is not.
    if (path.isSuper() && path.parentPath.isCallExpression()) {
      return
    }
    throw new NotBakeableError(`Unsupported recipe syntax: ${path.node.type}.`)
  }
  if (path.isFunction() && (path.node.async || path.node.generator)) {
    throw new NotBakeableError('Asynchronous and generator recipes stay at runtime.')
  }
  if ((path.isObjectMethod() || path.isClassMethod()) && (path.node.kind === 'get' || path.node.kind === 'set')) {
    throw new NotBakeableError('User-defined accessors are not evaluated.')
  }
  if (path.isClassProperty() && (path.node.static || path.node.decorators?.length)) {
    throw new NotBakeableError('Static class state and decorators are not evaluated.')
  }
  if (path.isThisExpression() && !path.findParent(parent => parent.isClass())) {
    throw new NotBakeableError('Runtime this binding.')
  }
  if (path.isMemberExpression() || path.isOptionalMemberExpression()) {
    const property = path.node.property
    const name = path.node.computed ? (t.isStringLiteral(property) ? property.value : undefined) : (t.isIdentifier(property) ? property.name : undefined)
    if (name === 'random' && t.isIdentifier(path.node.object, {name: 'Math'}) && !allowFreezingRandomness) {
      throw new NotBakeableError('Unseeded randomness.')
    }
    if (name && forbiddenProperties.has(name)) {
      throw new NotBakeableError(`Nondeterministic or reflective property: ${name}.`)
    }
  }
}

/** Slices only reachable declarations. Application modules are never imported/executed wholesale. */
export default class Recipe {
  readonly dependencies = new Set<string>
  usesResource = false
  private readonly declarations: Array<t.Statement> = []
  private readonly nativeValues: Array<{
    allowRandomProperty: boolean
    value: unknown
  }> = []
  private sequence = 0
  private readonly slots = new Map<t.Node, Slot>

  constructor(private readonly graph: SourceGraph, private readonly adapter: BakeAdapter, private readonly allowFreezingRandomness = false) {}

  async evaluate(path: NodePath, timeoutMs: number, input: t.CallExpression | t.NewExpression = path.node as t.CallExpression | t.NewExpression): Promise<EvaluatedRecipe> {
    return this.evaluateValue(path, timeoutMs, input, true)
  }

  /** Shared closed-data evaluator for compilers which do not produce Three resources. */
  async evaluateValue(path: NodePath, timeoutMs: number, input: t.Expression, requireResource = false): Promise<EvaluatedRecipe> {
    const expression = await this.rewrite(t.cloneNode(input, true), path, this.graph.source(path))
    if (requireResource && !this.usesResource) {
      throw new NotBakeableError('Not a recognized resource recipe.')
    }
    const nativeRoot = t.isNewExpression(input) && t.isIdentifier(input.callee) ? input.callee.name : undefined
    const rootExpression = nativeRoot && t.isNewExpression(expression) ? t.cloneNode(expression.callee) : t.unaryExpression('void', t.numericLiteral(0))
    const output = t.objectExpression([
      t.objectProperty(t.identifier('value'), expression),
      t.objectProperty(t.identifier('rootConstructor'), rootExpression as t.Expression),
    ])
    const file = t.file(t.program([
      ...this.declarations,
      t.expressionStatement(output),
    ]))
    const transformed = transformFromAstSync(file, '', {
      filename: 'recipe.ts',
      babelrc: false,
      configFile: false,
      plugins: [transformTypescript],
      comments: false,
    })!
    const code = transformed.code!
    const readonly = new ReadOnlyGraph
    const start = performance.now()
    const randomGuard = this.allowFreezingRandomness ? '' : "Object.defineProperty(Math, 'random', {value() {throw new Error('Unseeded randomness.')}});"
    const recipeScript = new Script(`'use strict'; ${randomGuard} Object.freeze(Math);\n${code}`)
    const result = recipeScript.runInNewContext({
      __bakeNative: this.nativeValues.map(({allowRandomProperty, value}) => protectNative(value, allowRandomProperty)),
      __bakeReadonly: readonly.capture,
      __bakeIdentityAccess: identityAccess(this.adapter.types),
    }, {
      timeout: timeoutMs,
      contextCodeGeneration: {
        strings: false,
        wasm: false,
      },
    }) as {
      rootConstructor?: {prototype: object}
      value: unknown
    }
    return {
      value: result.value,
      rootPrototype: result.rootConstructor?.prototype,
      runtimeConstructor: nativeRoot,
      isShared: readonly.isShared,
      dependencies: this.dependencies,
      code,
      evaluationMs: performance.now() - start,
    }
  }

  private async binding(binding: Binding, source: SourceModule): Promise<string> {
    assertConstant(binding)
    return this.declaration(binding.path, source, binding.identifier.name)
  }

  private async declaration(path: NodePath, source: SourceModule, bindingName?: string): Promise<string> {
    const key = path.isVariableDeclarator() && !t.isIdentifier(path.node.id) && bindingName ? t.getBindingIdentifiers(path.node.id)[bindingName] : path.node
    const previous = this.slots.get(key)
    if (previous) {
      if (previous.pending) {
        throw new NotBakeableError('Cyclic recipe dependency.')
      }
      return previous.name
    }
    if (this.slots.size >= maxDependencies) {
      throw new NotBakeableError('Recipe dependency limit exceeded.')
    }
    const slot: Slot = {
      name: `__bake${this.sequence++}`,
      pending: true,
    }
    this.slots.set(key, slot)
    const imported = importInfo(path)
    let expression: t.Expression
    let capture = false
    if (imported) {
      const native = this.adapter.modules.get(imported.source) ?? mathModule(imported.source, this.allowFreezingRandomness) ?? await this.adapter.loadModule?.(imported.source, {allowFreezingRandomness: this.allowFreezingRandomness})
      if (native) {
        const value = imported.imported === '*' ? native : native[imported.imported]
        if (value === undefined) {
          throw new NotBakeableError(`Unapproved native export: ${imported.source}:${imported.imported}.`)
        }
        if (this.adapter.roots.has(value) || imported.imported === '*' && Object.values(native).some(item => this.adapter.roots.has(item))) {
          this.usesResource = true
        }
        const allowRandomProperty = this.allowFreezingRandomness || imported.source === 'math/random' && imported.imported === '*'
        expression = t.memberExpression(t.identifier('__bakeNative'), t.numericLiteral(this.nativeValues.push({
          allowRandomProperty,
          value,
        }) - 1), true)
      } else {
        if (!imported.source.startsWith('.') && !imported.source.startsWith('#') && !imported.source.startsWith('/') && !/^[A-Za-z]:[/\\]/u.test(imported.source)) {
          throw new NotBakeableError(`Unapproved module: ${imported.source}.`)
        }
        if (imported.imported === '*') {
          throw new NotBakeableError('Local namespace imports require a named export.')
        }
        const id = await this.graph.resolve(imported.source, source.id)
        if (!id || id.includes('/node_modules/')) {
          throw new NotBakeableError(`Cannot evaluate module: ${imported.source}.`)
        }
        const target = await this.graph.exported(id, imported.imported, new Set, this.dependencies)
        const dependency = await this.declaration(target, this.graph.source(target), imported.imported)
        expression = t.identifier(dependency)
      }
    } else if (path.isFunctionDeclaration() || path.isClassDeclaration()) {
      const declarationBinding = path.node.id && path.scope.getBinding(path.node.id.name)
      if (declarationBinding) {
        assertConstant(declarationBinding)
      }
      expression = await this.rewrite(t.toExpression(t.cloneNode(path.node, true)), path, source)
    } else if (path.isVariableDeclarator()) {
      if (t.isIdentifier(path.node.id)) {
        const declarationBinding = path.scope.getBinding(path.node.id.name)
        if (declarationBinding) {
          assertConstant(declarationBinding)
        }
      }
      const init = path.node.init
      if (!init || !t.isExpression(init)) {
        throw new NotBakeableError('Dependency has no static initializer.')
      }
      if (!path.parentPath.isVariableDeclaration({kind: 'const'})) {
        throw new NotBakeableError('Only const dependencies are evaluated.')
      }
      if (t.isIdentifier(path.node.id)) {
        expression = await this.rewrite(t.cloneNode(init, true), path, source)
      } else {
        if (!bindingName) {
          throw new NotBakeableError('Destructured export cannot be resolved.')
        }
        const declaration = t.variableDeclaration('const', [t.variableDeclarator(t.cloneNode(path.node.id, true), t.cloneNode(init, true))])
        const accessor = t.callExpression(t.arrowFunctionExpression([], t.blockStatement([declaration, t.returnStatement(t.identifier(bindingName))])), [])
        expression = await this.rewrite(accessor, path, source)
      }
      capture = !t.isFunction(init) && !t.isClass(init)
    } else if (path.isExpression()) {
      expression = await this.rewrite(t.cloneNode(path.node, true), path, source)
      capture = !path.isFunction() && !path.isClass()
    } else {
      throw new NotBakeableError(`Dynamic dependency: ${path.node.type}.`)
    }
    this.declarations.push(t.variableDeclaration('const', [t.variableDeclarator(t.identifier(slot.name), capture ? t.callExpression(t.identifier('__bakeReadonly'), [expression]) : expression)]))
    slot.pending = false
    return slot.name
  }

  private async rewrite(node: t.Expression, original: NodePath, source: SourceModule): Promise<t.Expression> {
    this.dependencies.add(source.id)
    const ast = eraseTypes(t.file(t.program([t.expressionStatement(node)])))
    const references: Array<NodePath<t.Identifier>> = []
    traverse(ast, {
      enter: path => validate(path, this.allowFreezingRandomness),
      ReferencedIdentifier(path) {
        if (!path.isIdentifier() || isType(path) || path.scope.getBinding(path.node.name)) {
          return
        }
        references.push(path)
      },
    })
    // NodePaths are collected first because Babel traversal itself is synchronous.
    for (const reference of references) {
      const name = reference.node.name
      const binding = original.scope.getBinding(name)
      if (binding) {
        const replacement = await this.binding(binding, source)
        reference.replaceWith(t.identifier(replacement))
      } else if (!globals.has(name)) {
        throw new NotBakeableError(`Runtime or unknown binding: ${name}.`)
      }
    }
    guardIdentities(ast)
    return (ast.program.body[0] as t.ExpressionStatement).expression
  }
}
