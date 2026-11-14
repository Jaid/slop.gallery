import optis from 'optis'
import readPermalink, {parseBoolean} from 'read-permalink'

import {openRouterOrigin} from './openRouterAccess.ts'

/**
 * OpenRouter’s routing variant for each `ai_tier`, appended to a model ID. `:floor` sorts the model’s endpoints by price and lets flex endpoints compete, `:nitro` sorts them by throughput and lets priority endpoints compete.
 * OpenRouter also accepts `:priority`, but routes it like no variant at all.
 */
const tierVariants = {
  flex: 'floor',
  priority: 'nitro',
} as const
export type AiTier = keyof typeof tierVariants

const defaultSttModel = 'x-ai/grok-stt-1.0'
const defaults = {
  ai: true,
  /** the service tier to ask for; without one, model IDs go out unchanged */
  ai_tier: undefined as AiTier | undefined,
  text_model: 'google/gemini-4-hydrogen',
  text_model_effort: 'low',
  image_model: 'google/gemini-nano-banana-2.1',
  audio_model: 'google/gemini-3.8-flash-tts',
  /** the speech-to-text model that times every generated narration’s words for its subtitles, or `false` to skip that step and pace subtitles by an estimate */
  stt_model: defaultSttModel as false | string,
  /** the speech model’s voice ID; without it, the environment seed picks the narrator’s voice */
  narrator_voice: undefined as string | undefined,
  /** the narrator’s delivery instructions, sent verbatim; without them, the environment seed picks the narrator’s traits */
  narrator_character: undefined as string | undefined,
  eager_audio: false,
  /** the origin serving OpenRouter’s API, like an OpenRouter proxy or another server speaking the same API; a bare host like `openrouter.nas.lan` means HTTPS */
  openrouter_host: openRouterOrigin,
  /** the API key this page starts with instead of the one the player saved, or `false` to send every request without one and lock the key input, for a host that adds its own */
  openrouter_key: undefined as false | string | undefined,
}
const normalizeBoolean = (fallback: boolean) => (value: unknown) => {
  try {
    return parseBoolean(value)
  } catch {
    return fallback
  }
}
const normalizeString = (fallback: string) => (value: unknown) => (typeof value === 'string' ? value : fallback)
/** a model ID, `false` for a `false` or `0` flag, and the default for a bare, `true` or `1` one */
const normalizeOptionalModel = (fallback: string) => (value: unknown): false | string => {
  if (value === false) {
    return false
  }
  if (typeof value !== 'string' || !value.trim()) {
    return fallback
  }
  try {
    return parseBoolean(value) && fallback
  } catch {
    return value.trim()
  }
}
/** a non-blank string, or `undefined` to let the environment seed decide */
const normalizeOptionalString = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)
/** the origin of an HTTP(S) URL or of a bare host, which means HTTPS, and OpenRouter’s own for anything else */
const normalizeHost = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return openRouterOrigin
  }
  const host = value.trim()
  const url = URL.parse(/^[a-z][\d+\-.a-z]*:\/\//iu.test(host) ? host : `https://${host}`)
  return url && (url.protocol === 'https:' || url.protocol === 'http:') ? url.origin : openRouterOrigin
}
/** `false` for a `false` or `0` flag, a non-blank key as given, and `undefined` for anything else, which leaves the saved key */
const normalizeKey = (value: unknown): false | string | undefined => {
  try {
    return parseBoolean(value) && undefined
  } catch {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
}
const aiSettingsSchema = optis({
  defaults,
  normalizations: {
    ai: normalizeBoolean(defaults.ai),
    ai_tier: (value: unknown): AiTier | undefined => (typeof value === 'string' && Object.hasOwn(tierVariants, value) ? value as AiTier : undefined),
    text_model: normalizeString(defaults.text_model),
    text_model_effort: normalizeString(defaults.text_model_effort),
    image_model: normalizeString(defaults.image_model),
    audio_model: normalizeString(defaults.audio_model),
    stt_model: normalizeOptionalModel(defaultSttModel),
    narrator_voice: normalizeOptionalString,
    narrator_character: normalizeOptionalString,
    eager_audio: normalizeBoolean(defaults.eager_audio),
    openrouter_host: normalizeHost,
    openrouter_key: normalizeKey,
  },
})

export type AiSettings = ReturnType<typeof readAiSettings>

/**
 * The ID to send for `model` at the service tier `tier`, with its routing variant appended, or unchanged without a tier.
 * Only for the chat and speech endpoints, which is why images are made through chat too: OpenRouter’s `/images` endpoint knows no variants and answers 404 to any.
 */
export function tieredModel(model: string, tier: AiTier | undefined) {
  return tier ? `${model}:${tierVariants[tier]}` : model
}

export function readAiSettings(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  return readPermalink(input, {schema: aiSettingsSchema})
}

/** Applies a settings change; once the page is opened with `?ai=false`, nothing can switch AI back on. */
export function patchAiSettings(current: AiSettings, patch: Partial<AiSettings>, available: boolean): AiSettings {
  const next = {
    ...current,
    ...patch,
  }
  next.ai = available && next.ai
  return next
}
