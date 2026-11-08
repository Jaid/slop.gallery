import type {Page} from 'puppeteer-core'

/** Runs one of the app’s WebMCP tools in a page once the app has registered it, and resolves with its result as the browser serialized it: tools returning a string give it as is, others as JSON. The browser needs `--enable-features=WebMCP`. */
export const executeWebmcpTool = async (page: Page, name: string, input: Record<string, unknown> = {}) => {
  await page.waitForFunction(async (tool: string) => {
    const tools = await document.modelContext?.getTools()
    return Boolean(tools?.some(candidate => candidate.name === tool))
  }, {timeout: 60_000}, name)
  const result = await page.evaluate(async (tool: string, toolInput: Record<string, unknown>) => {
    const context = document.modelContext!
    const tools = await context.getTools()
    const registered = tools.find(candidate => candidate.name === tool)!
    return context.executeTool(registered, toolInput)
  }, name, input)
  return result
}

/** Runs one of the app’s WebMCP tools in a page once the app has registered it, and resolves with its parsed JSON result. The browser needs `--enable-features=WebMCP`. */
export const callWebmcpTool = async (page: Page, name: string, input: Record<string, unknown> = {}) => JSON.parse(await executeWebmcpTool(page, name, input)) as unknown

/**
 * Polls the app’s `get_loading_items` tool until nothing is left loading, so the next frame shows everything in place. Gives up once the items stay the same for `timeout` milliseconds; Knottingham’s Knot materials alone can take minutes.
 * `between` runs between polls while something is left, e.g. to render a frame under a stopped virtual clock: objects streaming in and shadow maps missing them only get further with frames.
 */
export const waitForLoadingItems = async (page: Page, {between, timeout = 120_000}: {
  between?: () => Promise<unknown>
  timeout?: number
} = {}) => {
  let last: string | undefined
  let deadline = 0
  for (;;) {
    const items = await executeWebmcpTool(page, 'get_loading_items')
    // Chrome reports a tool’s empty string result as “Operation succeeded”.
    if (!items || /^Operation succeeded\.?$/u.test(items)) {
      return
    }
    if (items !== last) {
      last = items
      deadline = Date.now() + timeout
    } else if (Date.now() > deadline) {
      throw new Error(`Nothing finished loading for ${timeout / 1000} s: ${items.replaceAll('\n', ', ')}.`)
    }
    await new Promise(resolve => setTimeout(resolve, 20))
    await between?.()
  }
}

/** what `end_warmup` reports: whether the page was still warming up, and the drawing buffer’s size it renders at from now on */
export type WarmupEnd = {
  height: number
  warmed: boolean
  width: number
}

/**
 * Ends the page’s capture warmup (see `CaptureWarmup`) through the app’s `end_warmup` tool, which resolves once the canvas has its regular size. Call it once nothing is left loading at the warmup scale, then render a few frames before capturing, so temporal effects build their history at the new size. A page without a warmup reports `warmed: false` and its current size.
 */
export const endWarmup = (page: Page) => callWebmcpTool(page, 'end_warmup') as Promise<WarmupEnd>

/** Changes the wireframe flood through the `set_wireframe` tool, with its snake_case input, and resolves with the whole flood now in effect. */
export const setWireframe = (page: Page, input: Record<string, unknown>) => callWebmcpTool(page, 'set_wireframe', input) as Promise<Record<string, unknown>>
