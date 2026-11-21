import type {Candidate} from './candidates.ts'
import type {BakeAdapter, BakeDiagnostic, BakeOptions, NativeType, SnapshotCodec} from './types.ts'
import type {HtmlTagDescriptor, Plugin, ResolvedConfig} from 'vite'

import {createHash} from 'node:crypto'
import {posix, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import {brotliCompressSync, constants} from 'node:zlib'

import MagicString from 'magic-string'
import {withFilter} from 'vite'

import {deferredDefinition, definitionCandidate} from './candidates.ts'
import {Inclusion, normalizeId, scopePath} from './filters.ts'
import Recipe, {describeExpression} from './Recipe.ts'
import SnapshotWriter from './SnapshotWriter.ts'
import SourceGraph from './SourceGraph.ts'

const sourceFile = /\.[cm]?[jt]sx?$/u
const matches = (filter: BakeOptions['exclude'], id: string) => {
  if (!filter) {
    return false
  }
  if (typeof filter === 'function') {
    return filter(id)
  }
  filter.lastIndex = 0
  return filter.test(id)
}
type Artifact = {
  bytes: Uint8Array
  codecs: Map<string, SnapshotCodec>
  compressed: boolean
  constructors: Map<string, NativeType>
  fileName?: string
  reference?: string
}

/** Build-only partial evaluation with explicit, reusable native capabilities. */
export default function createBakePlugin(adapter: BakeAdapter, options: BakeOptions = {}): Plugin {
  const prefix = `virtual:bake-${adapter.name}:`
  const resolvedPrefix = `\0${prefix}`
  const runtime = normalizeId(fileURLToPath(new URL('runtime.ts', import.meta.url)))
  const artifacts = new Map<string, Artifact>
  const diagnostics: Array<BakeDiagnostic> = []
  let config: ResolvedConfig
  let graph: SourceGraph
  let inclusion: Inclusion
  const diagnostic = (value: BakeDiagnostic) => {
    diagnostics.push(value)
    options.onDiagnostic?.(value)
  }
  const plugin: Plugin = {
    name: `bake-${adapter.name}`,
    apply: 'build',
    enforce: 'pre',
    configResolved(value) {
      config = value
      inclusion = new Inclusion(options.include, normalizeId(value.root))
    },
    buildStart() {
      artifacts.clear()
      diagnostics.length = 0
      graph = new SourceGraph(async (source, importer) => {
        const resolved = await this.resolve(source, importer, {skipSelf: true})
        return resolved && !resolved.external ? normalizeId(resolved.id) : undefined
      })
    },
    resolveId(id) {
      return {
        id: `\0${id}`,
        moduleSideEffects: false,
      }
    },
    load(id) {
      const hash = id.slice(resolvedPrefix.length)
      const artifact = artifacts.get(hash)
      if (!artifact) {
        this.error(`Missing baked artifact: ${hash}`)
      }
      artifact.reference ??= this.emitFile({
        type: 'asset',
        name: `baked-${adapter.name}-${hash}.bin`,
        source: artifact.bytes,
      })
      const imports: Array<string> = [`import {loadSnapshot} from ${JSON.stringify(runtime)}`]
      const constructors: Array<string> = []
      for (const [index, type] of artifact.constructors.values().toArray().entries()) {
        imports.push(`import {${type.name} as C${index}} from ${JSON.stringify(type.module)}`)
        constructors.push(`${JSON.stringify(type.name)}:C${index}`)
      }
      const codecs: Array<string> = []
      for (const [index, codec] of artifact.codecs.values().toArray().entries()) {
        imports.push(`import {${codec.exportName} as R${index}} from ${JSON.stringify(codec.module)}`)
        codecs.push(`${JSON.stringify(codec.name)}:R${index}`)
      }
      return `${imports.join('\n')}\nexport default await loadSnapshot(import.meta.ROLLDOWN_FILE_URL_${artifact.reference},{${constructors.join(',')}},${artifact.compressed},{${codecs.join(',')}})\n`
    },
    async transform(code, rawId) {
      const id = normalizeId(rawId)
      if (config.build.ssr || id === runtime) {
        return
      }
      const select = inclusion.select(id)
      if (!select || matches(options.exclude, id)) {
        return
      }
      const source = await graph.input(id, code)
      const candidates: Array<Candidate> = [...await adapter.candidates?.(source) ?? []]
      source.path.traverse({
        CallExpression(path) {
          candidates.push({
            path,
            expression: path.node,
            kind: 'expression',
          })
        },
        NewExpression(path) {
          candidates.push({
            path,
            expression: path.node,
            kind: 'expression',
          })
        },
        ClassDeclaration(path) {
          const candidate = definitionCandidate(path)
          if (candidate) {
            candidates.push(candidate)
          }
        },
        FunctionDeclaration(path) {
          const candidate = definitionCandidate(path)
          if (candidate) {
            candidates.push(candidate)
          }
        },
        VariableDeclarator(path) {
          const candidate = definitionCandidate(path)
          if (candidate) {
            candidates.push(candidate)
          }
        },
      })
      candidates.sort((a, b) => (a.start ?? a.path.node.start!) - (b.start ?? b.path.node.start!) || (b.end ?? b.path.node.end!) - (a.end ?? a.path.node.end!))
      const output = new MagicString(code)
      const imports = new Map<string, string>
      let replacedUntil = -1
      for (const candidate of candidates) {
        const {path} = candidate
        if ((candidate.start ?? path.node.start!) < replacedUntil) {
          continue
        }
        const scope = scopePath(path)
        if (!select(scope)) {
          continue
        }
        const recipe = new Recipe(graph, adapter, options.allowFreezingRandomness ?? false)
        const entry: BakeDiagnostic = {
          file: normalizeId(relative(config.root, id)),
          line: path.node.loc?.start.line ?? 0,
          expression: describeExpression(candidate.expression),
          scope,
          status: 'skipped',
        }
        try {
          if (candidate.kind === 'expression') {
            const deferred = await deferredDefinition(path, graph, adapter)
            // The definition bakes in its own module whenever this pass looks at it there.
            if (deferred) {
              const target = graph.source(deferred).id
              if (inclusion.select(target)?.(scopePath(deferred)) && !matches(options.exclude, target)) {
                continue
              }
            }
          }
          const evaluated = await recipe.evaluate(path, options.timeoutMs ?? 10_000, candidate.expression)
          const writer = new SnapshotWriter(adapter, options.maxBytes ?? 64 * 1024 * 1024, evaluated.isShared, evaluated.rootPrototype)
          const raw = writer.write(evaluated.value)
          if (!adapter.accepts(writer.resources)) {
            continue
          }
          if (raw.byteLength < (options.minimumBytes ?? 1024)) {
            entry.reason = 'Below minimumBytes.'
            diagnostic(entry)
            continue
          }
          const constructor = writer.needsRootConstructor ? evaluated.runtimeConstructor : undefined
          if (writer.needsRootConstructor && !constructor) {
            throw new Error('Custom factory result has no accessible constructor.')
          }
          const compressed = options.compress !== false
          const bytes = compressed ? brotliCompressSync(raw, {params: {[constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY}}) : raw
          const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24)
          artifacts.set(hash, artifacts.get(hash) ?? {
            bytes,
            constructors: writer.constructors,
            codecs: writer.codecs,
            compressed,
          })
          let factory = imports.get(hash)
          if (!factory) {
            factory = source.path.scope.generateUidIdentifier('bakedResource').name
            imports.set(hash, factory)
          }
          if (candidate.kind === 'custom') {
            for (const edit of candidate.edits!(factory)) {
              if (edit.start === edit.end) {
                output.appendLeft(edit.start, edit.text)
              } else {
                output.overwrite(edit.start, edit.end, edit.text)
              }
            }
          } else if (candidate.kind === 'class' && path.isClassDeclaration()) {
            const body = path.get('body')
            let hasConstructor = false
            for (const member of body.get('body')) {
              if (member.isClassProperty() && !member.node.static) {
                output.remove(member.node.start!, member.node.end!)
              } else if (member.isClassMethod({kind: 'constructor'})) {
                output.overwrite(member.node.start!, member.node.end!, `constructor() { return ${factory}(new.target) }`)
                hasConstructor = true
              }
            }
            if (!hasConstructor) {
              output.appendLeft(body.node.start! + 1, `constructor() { return ${factory}(new.target) }`)
            }
          } else if (candidate.kind === 'function') {
            output.overwrite(candidate.body!.node.start!, candidate.body!.node.end!, `{ return ${factory}() }`)
          } else {
            output.overwrite(path.node.start!, path.node.end!, `${factory}(${constructor ?? ''})`)
          }
          replacedUntil = candidate.end ?? path.node.end!
          for (const dependency of evaluated.dependencies) {
            this.addWatchFile(dependency)
          }
          diagnostic({
            ...entry,
            status: 'baked',
            bytes: bytes.byteLength,
            rawBytes: raw.byteLength,
            evaluationMs: evaluated.evaluationMs,
            resources: [...writer.resources],
          })
        } catch (error) {
          if (recipe.usesResource) {
            diagnostic({
              ...entry,
              reason: Error.isError(error) ? error.message : String(error),
            })
          }
        }
      }
      if (!imports.size) {
        return
      }
      output.prepend([...imports].map(([hash, name]) => `import ${name} from ${JSON.stringify(`${prefix}${hash}`)};\n`).join(''))
      return {
        code: output.toString(),
        map: output.generateMap({
          source: id,
          includeContent: true,
          hires: true,
        }),
      }
    },
    generateBundle(_outputOptions, bundle) {
      const retained = new Set(Object.values(bundle).flatMap(output => (output.type === 'chunk' ? Object.keys(output.modules).filter(id => id.startsWith(resolvedPrefix)).map(id => id.slice(resolvedPrefix.length)) : [])))
      for (const [hash, artifact] of artifacts) {
        if (!artifact.reference) {
          continue
        }
        if (retained.has(hash)) {
          artifact.fileName = this.getFileName(artifact.reference)
        } else {
          delete bundle[this.getFileName(artifact.reference)]
        }
      }
      const baked = diagnostics.filter(item => item.status === 'baked')
      if (options.report === true) {
        this.emitFile({
          type: 'asset',
          fileName: `bake-${adapter.name}.json`,
          source: JSON.stringify({
            recipes: baked.length,
            artifacts: retained.size,
            diagnostics,
          }, null, 2),
        })
      }
      if (baked.length) {
        const bytes = [...retained].reduce((sum, hash) => sum + artifacts.get(hash)!.bytes.byteLength, 0)
        config.logger.info(`[bake-${adapter.name}] ${baked.length} recipes, ${retained.size} retained artifacts, ${(bytes / 1024).toFixed(1)} KiB`)
      }
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, {bundle, chunk, path}) {
        if (!bundle || !chunk) {
          return
        }
        // Each snapshot module awaits its fetch before the next one runs, so the page starts every download its static imports need at once.
        const files = new Set<string>
        const visited = new Set<string>
        const visit = (fileName: string) => {
          // Imports also name external modules, which aren’t in the bundle.
          const output = fileName in bundle ? bundle[fileName] : undefined
          if (visited.has(fileName) || output?.type !== 'chunk') {
            return
          }
          visited.add(fileName)
          for (const [id, module] of Object.entries(output.modules)) {
            const file = id.startsWith(resolvedPrefix) && module.renderedLength ? artifacts.get(id.slice(resolvedPrefix.length))?.fileName : undefined
            if (file) {
              files.add(file)
            }
          }
          for (const imported of output.imports) {
            visit(imported)
          }
        }
        visit(chunk.fileName)
        const relativeBase = !config.base || config.base.startsWith('.')
        return [...files].map((file): HtmlTagDescriptor => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            // Matches the credentials of a plain fetch, so the request reuses the preloaded response.
            crossorigin: true,
            href: relativeBase ? posix.relative(posix.dirname(path), `/${file}`) : `${config.base}${file}`,
          },
          injectTo: 'head',
        }))
      },
    },
  }
  return withFilter(plugin, {
    resolveId: {id: new RegExp(`^${RegExp.escape(prefix)}`, 'u')},
    load: {id: new RegExp(`^${RegExp.escape(resolvedPrefix)}`, 'u')},
    transform: {id: {
      include: sourceFile,
      exclude: [/[/\\](?:node_modules|vite-plugin-bake-core)[/\\]/u, /\0/u],
    }},
  })
}
