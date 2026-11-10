import type {Rolldown} from 'vite'

import {afterAll, beforeAll, expect, test} from 'bun:test'
import {join, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

import fs from 'fs-extra'
import {build} from 'vite'

import rapierPlugin from '../src/main.ts'

// Inside the package, so that the fixture finds Rapier.
const root = resolve(import.meta.dirname, '../temp/test')
const entry = `import RAPIER from '@dimforge/rapier3d-compat'

export default async function fall() {
  await RAPIER.init()
  const world = new RAPIER.World({x: 0, y: -9.81, z: 0})
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic())
  world.createCollider(RAPIER.ColliderDesc.ball(0.5), body)
  for (let i = 0; i < 60; i++) {
    world.step()
  }
  return body.translation().y
}
`
const buildFixture = async (name: string, options?: Parameters<typeof rapierPlugin>[0]) => {
  const folder = join(root, name)
  await fs.outputFile(join(folder, 'index.html'), '<!doctype html><html><head></head><body><script type="module" src="./main.js"></script></body></html>')
  await fs.outputFile(join(folder, 'main.js'), 'import fall from "./fall.js"\nglobalThis.fallen = fall()')
  await fs.outputFile(join(folder, 'fall.js'), entry)
  const result = await build({
    root: folder,
    base: '/game/',
    configFile: false,
    logLevel: 'silent',
    plugins: [rapierPlugin(options)],
    build: {minify: false},
  })
  if (Array.isArray(result) || 'close' in result) {
    throw new TypeError('Expected one completed build output.')
  }
  const assets = result.output.filter((output): output is Rolldown.OutputAsset => output.type === 'asset')
  const chunks = result.output.filter(output => output.type === 'chunk')
  return {
    folder,
    html: await fs.readFile(join(folder, 'dist/index.html'), 'utf8'),
    wasm: assets.filter(asset => asset.fileName.endsWith('.wasm')),
    code: chunks.map(chunk => chunk.code).join('\n'),
  }
}
beforeAll(() => fs.remove(root))
afterAll(() => fs.remove(root))
test('the WebAssembly leaves the JavaScript as a preloaded file of its own', async () => {
  const {code, html, wasm} = await buildFixture('preloaded')
  expect(wasm).toHaveLength(1)
  const [asset] = wasm
  const bytes = asset.source as Uint8Array
  // Every WebAssembly module starts with “\0asm”.
  expect([...bytes.slice(0, 4)]).toEqual([0, 97, 115, 109])
  expect(bytes.length).toBeGreaterThan(1_000_000)
  // As base64, it took a third more than its bytes.
  expect(code.length).toBeLessThan(bytes.length)
  expect(code).not.toContain('AGFzbQEAAAAB')
  expect(html).toContain(`<link rel="preload" as="fetch" crossorigin href="/game/${asset.fileName}">`)
}, 60_000)
test('the page skips the preload when asked to', async () => {
  const {html, wasm} = await buildFixture('lazy', {preload: false})
  expect(wasm).toHaveLength(1)
  expect(html).not.toContain('preload')
}, 60_000)
test('Rapier still runs from the file', async () => {
  const folder = join(root, 'running')
  await fs.outputFile(join(folder, 'fall.js'), entry)
  await build({
    root: folder,
    // A relative base makes the file’s URL relative to the module, which Bun can fetch from disk.
    base: './',
    configFile: false,
    logLevel: 'silent',
    plugins: [rapierPlugin()],
    build: {
      minify: false,
      rolldownOptions: {
        input: join(folder, 'fall.js'),
        preserveEntrySignatures: 'strict',
        output: {entryFileNames: 'fall.js'},
      },
    },
  })
  const {default: fall} = await import(pathToFileURL(join(folder, 'dist/fall.js')).href) as {default: () => Promise<number>}
  // A second of free fall
  expect(await fall()).toBeCloseTo(-9.81 / 2, 0)
}, 60_000)
test('modules other than Rapier’s pass untouched', () => {
  const plugin = rapierPlugin()
  const transform = plugin.transform as (this: unknown, code: string, id: string) => unknown
  expect(transform.call({}, 'export default 1', '/project/node_modules/three/build/three.webgpu.js')).toBeUndefined()
  expect(transform.call({}, 'export default 1', '/project/node_modules/@dimforge/rapier3d/rapier.js')).toBeUndefined()
})
test('a Rapier that inlines its WebAssembly another way fails the build', () => {
  const plugin = rapierPlugin()
  const transform = plugin.transform as (this: unknown, code: string, id: string) => unknown
  const context = {
    error(message: string): never {
      throw new Error(message)
    },
  }
  expect(() => transform.call(context, 'export default 1', String.raw`C:\project\node_modules\@dimforge\rapier2d-simd-compat\dist\rapier.mjs`)).toThrow('rapier2d-simd no longer inlines its WebAssembly the expected way.')
})
