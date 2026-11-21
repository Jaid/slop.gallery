import type {OpenRouterAccess} from './openRouterAccess.ts'

import {createOpenRouter} from '@openrouter/ai-sdk-provider'

import ExternalGenerator from './ExternalGenerator.ts'

/** fetch without the `Authorization` header, which the provider always sends, empty without a key, and which would keep a proxy from adding its own */
const unauthenticatedFetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  headers.delete('Authorization')
  return fetch(input, {
    ...init,
    headers,
  })
}) as typeof fetch

/** An external generator that also talks to OpenRouter through the AI SDK, which only loads with the first one, like for a flavor or a fusion, while narration gets by with plain HTTP. */
export default abstract class SdkGenerator extends ExternalGenerator {
  protected readonly provider: ReturnType<typeof createOpenRouter>

  constructor(access: OpenRouterAccess) {
    super(access)
    this.provider = createOpenRouter({
      apiKey: this.key ?? '',
      baseURL: this.api.href,
      extraBody: {
        temperature: 0,
        seed: 1,
      },
      headers: this.headers,
      ...this.key === undefined ? {fetch: unauthenticatedFetch} : {},
    })
  }
}
