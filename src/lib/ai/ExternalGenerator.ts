import type {OpenRouterAccess} from './openRouterAccess.ts'

import {isProxied, openRouterOrigin} from './openRouterAccess.ts'

/** Talks to OpenRouter’s API over plain HTTP, with the key only for OpenRouter itself; see SdkGenerator for the AI SDK. */
export default abstract class {
  /** the base of the API, `/api/v1/` on the access’s origin */
  protected readonly api: URL

  protected readonly headers: Record<string, string>

  /** the key requests authenticate with, none for a host other than OpenRouter, which adds its own */
  protected readonly key: string | undefined

  constructor(access: OpenRouterAccess) {
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
    this.key = isProxied(access) ? undefined : access.key
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
    if (this.key === undefined) {
      headers.delete('Authorization')
    } else {
      headers.set('Authorization', `Bearer ${this.key}`)
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
