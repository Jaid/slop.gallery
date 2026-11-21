import type {R3fStaticRenderingOptions} from './options.ts'
import type {StaticDiagnostic} from './plan.ts'
import type {Plugin, ResolvedConfig} from 'vite'

import {relative} from 'node:path'

import {Inclusion, normalizeId, SourceGraph} from 'vite-plugin-bake-core'

import {compileStaticRendering} from './compile.ts'
import {constructorsFor} from './optimize.ts'
import {resolveR3fStaticRenderingOptions} from './options.ts'

const matches = (filter: R3fStaticRenderingOptions['exclude'], id: string) => {
  if (!filter) {
    return false
  }
  if (typeof filter === 'function') {
    return filter(id)
  }
  filter.lastIndex = 0
  return filter.test(id)
}

export default function r3fStaticRendering(options: R3fStaticRenderingOptions = {}): Plugin {
  const resolved = resolveR3fStaticRenderingOptions(options)
  const prefix = 'virtual:r3f-static-rendering:'
  const modules = new Map<string, string>
  const diagnostics: Array<StaticDiagnostic> = []
  let config: ResolvedConfig
  let graph: SourceGraph
  let inclusion: Inclusion
  return {
    name: 'r3f-static-rendering',
    apply: 'build',
    enforce: 'pre',
    configResolved(value) {
      config = value
      inclusion = new Inclusion(options.include, normalizeId(value.root))
    },
    buildStart() {
      modules.clear()
      diagnostics.length = 0
      graph = new SourceGraph(async (source, importer) => {
        const result = await this.resolve(source, importer, {skipSelf: true})
        return result && !result.external ? normalizeId(result.id) : undefined
      })
    },
    resolveId(id) {
      if (id.startsWith(prefix)) {
        return {
          id: `\0${id}`,
          moduleSideEffects: false,
        }
      }
    },
    load(id) {
      if (id.startsWith(`\0${prefix}`)) {
        return modules.get(id.slice(1))
      }
    },
    async transform(code, rawId) {
      if ((!resolved.staticInstancing || !resolved.staticInstancing.enabled) && (!resolved.renderBundles || !resolved.renderBundles.enabled)) {
        return
      }
      const id = normalizeId(rawId)
      if (config.build.ssr || !/\.[jt]sx$/u.test(id) || id.includes('/node_modules/') || id.includes('\0')) {
        return
      }
      const select = inclusion.select(id)
      if (!select || matches(options.exclude, id)) {
        return
      }
      const result = await compileStaticRendering(code, id, options, graph, select)
      diagnostics.push(...result.diagnostics.map(item => ({
        ...item,
        file: normalizeId(relative(config.root, item.file)),
      })))
      for (const dependency of result.dependencies) {
        this.addWatchFile(dependency)
      }
      if (!result.plans.length) {
        return
      }
      for (const {hash, plan} of result.plans) {
        const types = constructorsFor(plan)
        modules.set(`${prefix}${hash}`, `import {${types.join(',')}} from 'three/webgpu';\nexport default {plan:${JSON.stringify(plan)},constructors:{${types.join(',')}}};`)
      }
      return {
        code: result.code,
        map: result.map,
      }
    },
    generateBundle(_options, bundle) {
      const retained = new Set(Object.values(bundle).flatMap(output => (output.type === 'chunk' ? Object.keys(output.modules).filter(id => id.startsWith(`\0${prefix}`)) : [])))
      const optimized = diagnostics.filter(item => item.status === 'optimized')
      if (options.report === true) {
        this.emitFile({
          type: 'asset',
          fileName: 'r3f-static-rendering.json',
          source: JSON.stringify({
            regions: optimized.length,
            retainedPlans: retained.size,
            diagnostics,
          }, null, 2),
        })
      }
      if (optimized.length) {
        config.logger.info(`[r3f-static-rendering] ${optimized.length} regions, ${retained.size} retained plans`)
      }
    },
  }
}

export type {StaticRenderAnalyzer, StaticRenderCandidate, StaticRenderFacts, StaticRenderReason} from './analysis.ts'
export {canBundle, defaultRenderBundlesOptions} from './features/renderBundles.ts'
export type {RenderBundlesOptions} from './features/renderBundles.ts'
export {canInstance, defaultStaticInstancingOptions} from './features/staticInstancing.ts'
export type {StaticInstancingOptions} from './features/staticInstancing.ts'
export {resolveR3fStaticRenderingOptions} from './options.ts'

export type {R3fStaticRenderingOptions, ResolvedR3fStaticRenderingOptions} from './options.ts'
export type {StaticDiagnostic, StaticPlan} from './plan.ts'
