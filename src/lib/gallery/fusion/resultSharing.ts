import optis from 'optis'
import readPermalink from 'read-permalink'

/** how a fusion’s result was made: by an image model, locally without AI as a collage of several images or as a single image tinted in the glows standing in for instructions, or not at all, as nothing was contributed to change the hung portrait, like by a Transparent Orb */
export type FusionMaking = 'ai' | 'collage' | 'tint' | 'unchanged'
/** which results of fusions a flag like `?download` shares: none, the new images (`true`) or `all` of them */
export type FusionResults = 'all' | boolean
/** what is known about a fusion’s result as it is shared */
export type FusionResultInfo = {
  /** when it flipped out of the portal */
  date: Date
  /** the titles of the fusion’s ingredients, the hung portrait’s first */
  ingredients: ReadonlyArray<string>
  making: FusionMaking
}

const enabledValues = new Set<unknown>([true, '', 'true'])
const normalizeResults = (value: unknown): FusionResults => {
  if (value === 'all') {
    return 'all'
  }
  return enabledValues.has(value)
}
/** the origin and path of an HTTP(S) URL or of a bare host, which means HTTPS, and `undefined` for anything else */
const normalizeEndpoint = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return
  }
  const endpoint = value.trim()
  const url = URL.parse(/^[a-z][\d+\-.a-z]*:\/\//iu.test(endpoint) ? endpoint : `https://${endpoint}`)
  return url && (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : undefined
}
const sharingSchema = optis({
  defaults: {
    download: false,
    webhook: false,
    webhook_endpoint: undefined as string | undefined,
  },
  normalizations: {
    download: normalizeResults,
    webhook: normalizeResults,
    webhook_endpoint: normalizeEndpoint,
  },
})
const readSharing = (input: URL | string = typeof location === 'undefined' ? '' : location.href) => readPermalink(input, {schema: sharingSchema})

/** Read the `?download` flag that saves the result of every fusion that succeeds as a WebP download: a bare `?download` or `?download=true` saves the new images, made by an image model or as a local collage, and `?download=all` also the tints that stand in for an image model’s instructions without AI and the hung portraits that came back unchanged. */
export function readDownload(input?: URL | string): FusionResults {
  return readSharing(input).download
}

/** Read the `?webhook` flag that posts the result of every fusion that succeeds as a WebP to `?webhook_endpoint`, picking results like {@link readDownload}. */
export function readWebhook(input?: URL | string): FusionResults {
  return readSharing(input).webhook
}

/** Read the `?webhook_endpoint` that `?webhook` posts fusion results to: an HTTP(S) URL, a bare host meaning HTTPS, or `undefined` for none or anything else. */
export function readWebhookEndpoint(input?: URL | string): string | undefined {
  return readSharing(input).webhook_endpoint
}

/** which results of fusions this page saves as downloads, read once at startup */
export const downloadedResults = readDownload()
/** which results of fusions this page posts to {@link webhookEndpoint}, read once at startup */
export const postedResults = readWebhook()
/** where this page posts the results of fusions, read once at startup */
export const webhookEndpoint = readWebhookEndpoint()

/** Whether `results` includes a result made by `making`. */
export function includesResult(making: FusionMaking, results: FusionResults) {
  if (results === 'all') {
    return true
  }
  return results && (making === 'ai' || making === 'collage')
}

/**
 * The multipart form a webhook gets for a fusion’s result: the WebP as `file`, named `fileName`, how it was made as `making`, the world as `world`, when it flipped out as `fused_at` (ISO 8601) and one `ingredient` per ingredient, by title, the hung portrait’s first.
 * A form keeps the request simple in CORS terms, so it reaches endpoints without any CORS setup, though the page can only read their answer with it.
 */
export function webhookForm(webp: Blob, fileName: string, world: string, {date, ingredients, making}: FusionResultInfo) {
  const form = new FormData
  form.append('file', webp, fileName)
  form.append('making', making)
  form.append('world', world)
  form.append('fused_at', date.toISOString())
  for (const ingredient of ingredients) {
    form.append('ingredient', ingredient)
  }
  return form
}
