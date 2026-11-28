import type {WebmcpBridge} from './tools.ts'

import createWebmcpTools from './tools.ts'

export default async function registerWebmcp(bridge: WebmcpBridge, controller: AbortController, modelContext: Pick<WebMCP.ModelContext, 'registerTool'> | undefined = document.modelContext) {
  const {signal} = controller
  if (!modelContext) {
    return
  }
  try {
    for (const tool of createWebmcpTools(bridge)) {
      if (signal.aborted) {
        return
      }
      await modelContext.registerTool(tool, {signal})
    }
  } catch (error) {
    if (signal.aborted) {
      return
    }
    // Roll back earlier registrations if a later tool fails.
    controller.abort(error)
    throw error
  }
}
