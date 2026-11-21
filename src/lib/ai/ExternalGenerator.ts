import type {OpenRouterAccess} from './openRouterAccess.ts'

import {createOpenRouter} from '@openrouter/ai-sdk-provider'

import {openRouterOrigin} from './openRouterAccess.ts'

/** fetch without the `Authorization` header, which the provider always sends, empty without a key, and which would keep a proxy from adding its own */
const unauthenticatedFetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
  const headers = new Headers(init.headers)
  headers.delete('Authorization')
  return fetch(input, {
    ...init,
    headers,
  })
}) as typeof fetch

export default abstract class {
  protected readonly headers: Record<string, string>

  protected readonly provider: ReturnType<typeof createOpenRouter>

  /** the base of the API, `/api/v1/` on the access’s origin */
  private readonly api: URL

  constructor(private readonly access: OpenRouterAccess) {
    const headers = {
      'HTTP-Referer': 'https://slop.gallery',
      'X-OpenRouter-Title': 'Slop Gallery',
      'X-OpenRouter-Categories': 'game,image-gen',
    }
    this.headers = headers
    if (globalThis.window !== globalThis) {
      // These only work outside of a browser context because of CORS restrictions.
      Object.assign(headers, {
        'X-OpenRouter-Cache': 'true',
        'X-OpenRouter-Cache-TTL': '86400',
      })
    }
    this.api = new URL('/api/v1/', access.origin ?? openRouterOrigin)
    this.provider = createOpenRouter({
      apiKey: access.key || '',
      baseURL: this.api.href,
      extraBody: {
        temperature: 0,
        seed: 1,
      },
      headers,
      ...access.key === false ? {fetch: unauthenticatedFetch} : {},
    })
  }
  /** Raw endpoints share the SDK’s app attribution, including offline generation scripts. */
  request(path: string, init: RequestInit = {}) {
    const url = new URL(path, this.api)
    if (url.origin !== this.api.origin || !url.pathname.startsWith('/api/')) {
      throw new Error('ExternalGenerator only accepts OpenRouter API endpoints.')
    }
    const headers = new Headers(init.headers)
    for (const [name, value] of Object.entries(this.headers)) {
      headers.set(name, value)
    }
    if (this.access.key === false) {
      headers.delete('Authorization')
    } else {
      headers.set('Authorization', `Bearer ${this.access.key}`)
    }
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(url.href, {
      ...init,
      headers,
    })
  }
}
