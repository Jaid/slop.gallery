import type {Plugin} from 'vite'

export type RapierPluginOptions = {
  /** whether the page preloads the WebAssembly, by default `true`; without it, the download only starts once the page initializes Rapier */
  preload?: boolean
}

/** the module of every compat flavor of Rapier, like `@dimforge/rapier3d-compat` or `@dimforge/rapier2d-simd-compat`, with the flavor’s name */
const rapierModule = /[/\\]@dimforge[/\\](rapier[23]d(?:-[a-z]+)*)-compat[/\\]dist[/\\]rapier\.mjs$/u
/** how the compat build decodes the WebAssembly it carries as base64 */
const inlinedWasm = /[\w$]+\.toByteArray\("([\d+/A-Za-z]+=*)"\)\.buffer/u

/**
 * Rapier’s compat builds inline their WebAssembly into the JavaScript as base64. This plugin emits it as a file of its own instead, which downloads smaller, compiles while it streams in and stays in the browser’s code cache, and lets the page preload it.
 * It only runs during `vite build`.
 */
export default function rapierPlugin({preload = true}: RapierPluginOptions = {}): Plugin {
  let base = '/'
  /** the names of the files emitted so far, kept across the rebuilds of a watching build, which don’t transform an unchanged Rapier again */
  const assetNames = new Set<string>
  return {
    name: 'rapier',
    apply: 'build',
    configResolved(config) {
      base = config.base
    },
    transform(code, id) {
      const flavor = rapierModule.exec(id)?.[1]
      if (!flavor) {
        return
      }
      const inlined = inlinedWasm.exec(code)
      if (!inlined) {
        this.error(`${flavor} no longer inlines its WebAssembly the expected way.`)
      }
      const name = `${flavor}.wasm`
      assetNames.add(name)
      const reference = this.emitFile({
        type: 'asset',
        name,
        source: Uint8Array.fromBase64(inlined[1]),
      })
      // Its initializer fetches a URL string just as well as it takes the bytes.
      return `${code.slice(0, inlined.index)}import.meta.ROLLUP_FILE_URL_${reference}${code.slice(inlined.index + inlined[0].length)}`
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, {bundle}) {
        if (!preload) {
          return
        }
        // Physics usually asks for it late, once the scene mounts, which would leave the largest download for last.
        return Object.values(bundle ?? {}).filter(output => output.type === 'asset' && output.names.some(name => assetNames.has(name))).map(asset => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            crossorigin: true,
            href: `${base}${asset.fileName}`,
          },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}
