/** the origin of OpenRouter’s own API */
export const openRouterOrigin = 'https://openrouter.ai'

/** where requests to OpenRouter’s API go and how they authenticate */
export type OpenRouterAccess = {
  /** the API key, which only ever goes to OpenRouter’s own origin; an empty string means there is none */
  key: string
  /** the origin serving OpenRouter’s API under `/api/`, OpenRouter’s own unless given, like that of a proxy or another server speaking the same API */
  origin?: string
}

/** whether `access` goes to a host other than OpenRouter itself, like an OpenRouter proxy, which never gets a key and has to add its own */
export function isProxied(access: OpenRouterAccess) {
  return (access.origin ?? openRouterOrigin) !== openRouterOrigin
}

/** whether requests can go out with `access`: to a host that adds its own key, or to OpenRouter with one */
export function hasAccess(access: OpenRouterAccess) {
  return isProxied(access) || access.key !== ''
}
