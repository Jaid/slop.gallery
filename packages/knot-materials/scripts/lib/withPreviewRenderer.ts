import type KnotPreviewRenderer from './KnotPreviewRenderer.ts'
import type {JSHandle, Page} from 'puppeteer-core'

import {resolve} from 'node:path'

import puppeteer from 'puppeteer-core'
import {createServer} from 'vite'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const renderPath = '/packages/knot-materials/scripts/render.html'
const rendererPath = '/packages/knot-materials/scripts/lib/KnotPreviewRenderer.ts'
const protocolTimeout = 300_000
let rendererSequence = 0
const createRenderer = async (page: Page, moduleURL: string) => {
  const key = `__knotPreviewRenderer_${process.pid}_${rendererSequence++}`
  const handle = await page.evaluateHandle(async (url, rendererKey) => {
    const {default: Renderer} = await import(/* @vite-ignore */ `${url}?t=${Date.now()}`) as typeof import('./KnotPreviewRenderer.ts')
    const renderer = new Renderer
    try {
      await renderer.init()
      ;(globalThis as unknown as Record<string, KnotPreviewRenderer | undefined>)[rendererKey] = renderer
      return renderer
    } catch (error) {
      await renderer.dispose()
      throw error
    }
  }, moduleURL, key)
  return {
    handle,
    key,
  }
}
const disposeRenderer = async (page: Page, key: string) => page.evaluate(async rendererKey => {
  const registry = globalThis as unknown as Record<string, KnotPreviewRenderer | undefined>
  const renderer = registry[rendererKey]
  delete registry[rendererKey]
  await renderer?.dispose()
}, key)
const runWithRenderer = async <Result>(page: Page, moduleURL: string, run: (renderer: JSHandle<KnotPreviewRenderer>) => Promise<Result>) => {
  const {
    handle,
    key,
  } = await createRenderer(page, moduleURL)
  try {
    return await run(handle)
  } finally {
    try {
      await disposeRenderer(page, key)
    } finally {
      await handle.dispose()
    }
  }
}

/** Run a detached WebGPU renderer in a private Vite page and private Chrome instance. */
export default async function withPreviewRenderer<Result>(run: (renderer: JSHandle<KnotPreviewRenderer>) => Promise<Result>) {
  const server = await createServer({
    cacheDir: 'node_modules/.vite-knot-preview',
    configFile: false,
    logLevel: 'error',
    // render.html loads the renderer dynamically. Scan it before the first frame, without scanning the gallery and its virtual voice imports.
    optimizeDeps: {
      entries: [rendererPath.slice(1)],
      include: ['okhsl', 'three', 'three/tsl', 'three/webgpu'],
    },
    root: repositoryRoot,
    server: {
      // This session owns long-lived browser handles. Source edits must not
      // reload its page or hot-swap modules while an offline render is running.
      hmr: false,
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
    },
  })
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  try {
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      throw new Error('Vite did not expose a local TCP port.')
    }
    const origin = `http://127.0.0.1:${address.port}`
    browser = await puppeteer.launch({
      executablePath: Bun.env.BROWSER,
      headless: true,
      protocolTimeout,
    })
    const page = await browser.newPage()
    await page.goto(`${origin}${renderPath}`, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    })
    return await runWithRenderer(page, `${origin}${rendererPath}`, run)
  } finally {
    try {
      await browser?.close()
    } finally {
      await server.close()
    }
  }
}
