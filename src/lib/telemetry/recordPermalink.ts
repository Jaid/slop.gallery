import type SlopGalleryTelemetry from './SlopGalleryTelemetry.ts'

import readPermalink, {parseBoolean} from 'read-permalink'

/** the query parameters whose values must never leave the page, unless they are just a flag like a bare `?openrouter_key` */
const secretKeys: ReadonlySet<string> = new Set(['openrouter_key'])
/** the query parameter read-permalink unpacks packed state from */
const dataKey = 'data'
const redacted = 'redacted'
const isFlag = (value: string) => {
  try {
    parseBoolean(value)
    return true
  } catch {
    return false
  }
}
const isSecret = (value: unknown) => typeof value === 'string' && value.trim() !== '' && !isFlag(value)
const hasSecret = (state: Record<string, unknown>) => Object.entries(state).some(([key, value]) => secretKeys.has(key) && isSecret(value))
const decodeComponent = (component: string) => decodeURIComponent(component.replaceAll('+', ' '))

/** The search query as given, without its leading `?`, with the value of every secret parameter, and every packed `data` payload holding one, replaced by `redacted`. */
export function redactSearch(search: string) {
  const query = search.startsWith('?') ? search.slice(1) : search
  return query.split('&').map(entry => {
    const separator = entry.indexOf('=')
    if (separator === -1) {
      return entry
    }
    const rawKey = entry.slice(0, separator)
    const key = decodeComponent(rawKey)
    if (secretKeys.has(key) && isSecret(decodeComponent(entry.slice(separator + 1)))) {
      return `${rawKey}=${redacted}`
    }
    if (key === dataKey && hasSecret(readPermalink(`?${entry}`))) {
      return `${rawKey}=${redacted}`
    }
    return entry
  }).join('&')
}

/** What read-permalink makes of the search query: ordinary parameters as strings merged with the decoded `data` payload, with secret values replaced by `redacted`. */
export function readSearch(search: string) {
  const query = search.startsWith('?') ? search.slice(1) : search
  const state: Record<string, unknown> = readPermalink(`?${query}`)
  return Object.fromEntries(Object.entries(state).map(([key, value]) => [key, secretKeys.has(key) && isSecret(value) ? redacted : value]))
}

/** Log the page’s permalink as `gallery.permalink.read`: the search query as `input` and what read-permalink reads from it as `output`, both redacted, as JSON in the message, since attributes are cut off after 1 kB. */
export default function recordPermalink(telemetry: SlopGalleryTelemetry, search = typeof location === 'undefined' ? '' : location.search) {
  telemetry.event('permalink.read', {}, JSON.stringify({
    input: redactSearch(search),
    output: readSearch(search),
  }))
}
