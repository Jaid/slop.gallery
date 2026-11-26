import {expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import fs from 'fs-extra'
import {build as rolldownBuild} from 'rolldown'
import {build as viteBuild} from 'vite'

import jxlHeadersPlugin, {headers, headersFileName} from '../src/main.ts'

test.each(['Rolldown', 'Vite'] as const)('%s emits a _headers file that serves JXL as image/jxl', async backend => {
  const root = await fs.mkdtemp(join(tmpdir(), 'jxl-headers-'))
  try {
    await fs.outputFile(join(root, 'index.html'), '<!doctype html><script type="module" src="./main.js"></script>')
    await fs.outputFile(join(root, 'main.js'), 'console.log(1)')
    const plugins = [jxlHeadersPlugin()]
    const assetFileNames = '[hash:8].[ext]'
    if (backend === 'Rolldown') {
      await rolldownBuild({
        input: join(root, 'main.js'),
        plugins,
        output: {
          dir: join(root, 'dist'),
          assetFileNames,
        },
      })
    } else {
      await viteBuild({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins,
        build: {rolldownOptions: {output: {assetFileNames}}},
      })
    }
    expect(headersFileName).toBe('_headers')
    expect(await fs.readFile(join(root, 'dist', headersFileName), 'utf8')).toBe(headers)
    expect(headers).toContain('/*.jxl\n  Content-Type: image/jxl')
  } finally {
    await fs.remove(root)
  }
})
