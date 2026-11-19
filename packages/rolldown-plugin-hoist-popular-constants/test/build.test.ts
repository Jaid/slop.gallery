import type {Plugin} from 'rolldown'
import type {Plugin as VitePlugin} from 'vite'

import {expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

import fs from 'fs-extra'
import {build as rolldownBuild} from 'rolldown'
import {minify} from 'terser'
import {build as viteBuild} from 'vite'

import hoistPopularConstants from '../src/main.ts'

for (const backend of ['Rolldown', 'Vite'] as const) {
  test(`${backend} hoists ESM constants before a final Terser pass and preserves exports and maps`, async () => {
    const root = await fs.mkdtemp(resolve(tmpdir(), 'hoist-popular-constants-'))
    try {
      const value = 'a repeated primitive constant that is profitable to pool'
      const values = Array.from({length: 5}, () => value)
      const input = resolve(root, 'main.ts')
      await fs.writeFile(input, `export const values = (): string[] => ${JSON.stringify(values)}; export default values`)
      let beforeMinification = ''
      const terser: Plugin = {
        name: 'test-final-terser',
        renderChunk: {
          order: 'post',
          async handler(code) {
            beforeMinification = code
            const result = await minify(code, {
              module: true,
              sourceMap: true,
            })
            if (!result.code) {
              throw new Error('Expected minified code.')
            }
            return {
              code: result.code,
              map: typeof result.map === 'string' ? result.map : JSON.stringify(result.map),
            }
          },
        },
      }
      const plugins = [hoistPopularConstants(), terser]
      const result = backend === 'Rolldown' ? await rolldownBuild({
        input,
        plugins,
        output: {
          format: 'es',
          sourcemap: true,
        },
        write: false,
      }) : await viteBuild({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins,
        build: {
          lib: {
            entry: input,
            formats: ['es'],
          },
          minify: false,
          sourcemap: true,
          write: false,
        },
      })
      const output = Array.isArray(result) ? result[0] : result
      if ('close' in output) {
        throw new TypeError('Expected one completed build output.')
      }
      const chunk = output.output.find(artifact => artifact.type === 'chunk' && artifact.isEntry)
      if (chunk?.type !== 'chunk') {
        throw new TypeError('Expected an entry chunk.')
      }
      expect(beforeMinification.split(value)).toHaveLength(2)
      expect(chunk.map?.sources.some(source => source?.endsWith('main.ts'))).toBe(true)
      const outputFile = resolve(root, 'bundle.mjs')
      await fs.writeFile(outputFile, chunk.code)
      const module = await import(pathToFileURL(outputFile).href) as {
        default: () => Array<string>
        values: () => Array<string>
      }
      expect(module.default).toBe(module.values)
      expect(module.values()).toEqual(values)
    } finally {
      await fs.remove(root)
    }
  })
}
test('leaves CommonJS output untouched', async () => {
  const plugin = hoistPopularConstants()
  if (typeof plugin.renderChunk !== 'object') {
    throw new TypeError('Expected a renderChunk hook.')
  }
  const code = 'sink("a long repeated constant","a long repeated constant","a long repeated constant")'
  expect(await plugin.renderChunk.handler.call({} as never, code, {fileName: 'chunk.cjs'} as never, {format: 'cjs'} as never, {} as never)).toBeNull()
})
test('runs before Vite’s built-in Terser minifier with Vite post-plugin placement', async () => {
  const root = await fs.mkdtemp(resolve(tmpdir(), 'hoist-vite-order-'))
  try {
    const input = resolve(root, 'main.js')
    await fs.writeFile(input, 'globalThis.values = ["a profitable repeated constant", "a profitable repeated constant", "a profitable repeated constant"]')
    const calls: Array<string> = []
    const hoist = hoistPopularConstants()
    if (typeof hoist.renderChunk !== 'object') {
      throw new TypeError('Expected a renderChunk hook.')
    }
    const originalHoist = hoist.renderChunk.handler
    hoist.renderChunk.handler = function (...args) {
      calls.push('hoist')
      return originalHoist.call(this, ...args)
    }
    const observeTerser: VitePlugin = {
      name: 'test-observe-vite-terser',
      configResolved(config) {
        const terser = config.plugins.find(plugin => plugin.name === 'vite:terser')
        const hook = terser?.renderChunk
        const handler = typeof hook === 'function' ? hook : hook?.handler
        if (!terser || !handler) {
          throw new TypeError('Expected Vite’s Terser plugin.')
        }
        terser.renderChunk = {
          ...typeof hook === 'object' ? hook : {},
          handler(...args) {
            calls.push('terser')
            return handler.call(this, ...args)
          },
        }
      },
    }
    await viteBuild({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        ...hoist,
        apply: 'build',
        enforce: 'post',
      }, observeTerser],
      build: {
        minify: 'terser',
        write: false,
        rolldownOptions: {input},
      },
    })
    expect(calls).toEqual(['hoist', 'terser'])
  } finally {
    await fs.remove(root)
  }
})
