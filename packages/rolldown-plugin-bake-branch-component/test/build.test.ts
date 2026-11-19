import {expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

import fs from 'fs-extra'
import {build as rolldownBuild} from 'rolldown'
import {build as viteBuild} from 'vite'

import bakeBranchComponent from '../src/main.ts'

for (const backend of ['Rolldown', 'Vite'] as const) {
  test(`${backend} bakes Branch before TypeScript and JSX lowering`, async () => {
    const root = await fs.mkdtemp(resolve(tmpdir(), 'bake-branch-component-'))
    try {
      const input = resolve(root, 'main.tsx')
      await fs.writeFile(input, `
        import Branch from 'branch-component'
        export const choose = (ready: boolean) => <Branch if={ready}>visible</Branch>
      `)
      const plugins = [bakeBranchComponent()]
      const external = ['branch-component', 'react', 'react/jsx-runtime']
      const result = backend === 'Rolldown' ? await rolldownBuild({
        input,
        plugins,
        external,
        output: {
          format: 'es',
          sourcemap: true,
        },
        write: false,
      }) : await viteBuild({
        root,
        configFile: false,
        logLevel: 'silent',
        // The Babel wrapper must run before Vite lowers JSX, not as an output plugin.
        plugins,
        build: {
          lib: {
            entry: input,
            formats: ['es'],
          },
          minify: false,
          sourcemap: true,
          write: false,
          rolldownOptions: {external},
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
      expect(chunk.imports).not.toContain('branch-component')
      expect(chunk.imports).not.toContain('react/jsx-runtime')
      expect(chunk.map?.sources.some(source => source?.endsWith('main.tsx'))).toBe(true)
      const outputFile = resolve(root, 'bundle.mjs')
      await fs.writeFile(outputFile, chunk.code)
      const module = await import(pathToFileURL(outputFile).href) as {choose: (ready: boolean) => string | null}
      expect(module.choose(true)).toBe('visible')
      expect(module.choose(false)).toBeNull()
    } finally {
      await fs.remove(root)
    }
  })
}
