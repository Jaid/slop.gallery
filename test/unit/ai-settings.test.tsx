import {expect, test} from 'bun:test'

import {renderToStaticMarkup} from 'react-dom/server'
import {GraphicsModeProvider} from 'use-graphics-mode'

import Menu from '#component/Menu'
import OpenRouterConnection from '#component/OpenRouterConnection'

import {patchAiSettings, readAiSettings, tieredModel} from '../../src/lib/ai/settings.ts'
import {useIntro} from '../../src/lib/gallery/intro.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'

test('model and narration preferences remain configurable through URL parameters', () => {
  const customSettingsQuery = new URLSearchParams({
    text_model: 'custom-text',
    image_model: 'custom-image',
    audio_model: 'custom-audio',
    text_model_effort: 'high',
    narrator_voice: 'custom-voice',
    narrator_character: 'custom-character',
    eager_audio: 'true',
  })
  const searchParams = customSettingsQuery.toString()
  const params = readAiSettings(`?${searchParams}`)
  expect(params).toMatchObject({
    text_model: 'custom-text',
    image_model: 'custom-image',
    audio_model: 'custom-audio',
    text_model_effort: 'high',
    narrator_voice: 'custom-voice',
    narrator_character: 'custom-character',
    eager_audio: true,
  })
})
test('?stt_model picks the model that times generated narration, and false skips that step', () => {
  const fallback = readAiSettings('').stt_model
  expect(fallback).toMatch(/^[\w-]+\/[\w\-.]+$/u)
  expect(readAiSettings('?stt_model=elevenlabs/scribe-v2').stt_model).toBe('elevenlabs/scribe-v2')
  expect(readAiSettings('?stt_model=false').stt_model).toBe(false)
  expect(readAiSettings('?stt_model=0').stt_model).toBe(false)
  expect(readAiSettings('?stt_model').stt_model).toBe(fallback)
  expect(readAiSettings('?stt_model=true').stt_model).toBe(fallback)
})
test('the narrator voice is only set by a non-blank ?narrator_voice, so the seed picks it otherwise', () => {
  expect(readAiSettings('').narrator_voice).toBeUndefined()
  expect(readAiSettings('?narrator_voice=').narrator_voice).toBeUndefined()
  expect(readAiSettings('?narrator_voice=Puck').narrator_voice).toBe('Puck')
})
test('the narrator character is only set by a non-blank ?narrator_character, so the seed picks it otherwise', () => {
  expect(readAiSettings('').narrator_character).toBeUndefined()
  expect(readAiSettings('?narrator_character=').narrator_character).toBeUndefined()
  expect(readAiSettings('?narrator_character=%20').narrator_character).toBeUndefined()
  expect(readAiSettings('?narrator_character=calm').narrator_character).toBe('calm')
})
test('?ai_tier appends OpenRouter’s routing variant, and nothing without a valid tier', () => {
  expect(readAiSettings('').ai_tier).toBeUndefined()
  expect(readAiSettings('?ai_tier=flex').ai_tier).toBe('flex')
  expect(readAiSettings('?ai_tier=priority').ai_tier).toBe('priority')
  for (const value of ['', 'fast', 'floor', 'FLEX', 'default']) {
    expect(readAiSettings(`?ai_tier=${value}`).ai_tier).toBeUndefined()
  }
  expect(tieredModel('google/gemini-4-argon', undefined)).toBe('google/gemini-4-argon')
  expect(tieredModel('google/gemini-4-argon', 'flex')).toBe('google/gemini-4-argon:floor')
  expect(tieredModel('google/gemini-3.8-flash-tts', 'priority')).toBe('google/gemini-3.8-flash-tts:nitro')
})
test('?openrouter_host names the origin serving OpenRouter’s API, a bare host meaning HTTPS', () => {
  expect(readAiSettings('').openrouter_host).toBe('https://openrouter.ai')
  expect(readAiSettings('?openrouter_host=openrouter.nas.lan').openrouter_host).toBe('https://openrouter.nas.lan')
  expect(readAiSettings('?openrouter_host=%20openrouter.nas.lan/%20').openrouter_host).toBe('https://openrouter.nas.lan')
  expect(readAiSettings('?openrouter_host=localhost:3310').openrouter_host).toBe('https://localhost:3310')
  expect(readAiSettings(`?openrouter_host=${encodeURIComponent('http://10.0.0.22:3310/api/v1')}`).openrouter_host).toBe('http://10.0.0.22:3310')
  for (const value of ['', '%20', 'ftp://example.com', 'exa%20mple.com']) {
    expect(readAiSettings(`?openrouter_host=${value}`).openrouter_host).toBe('https://openrouter.ai')
  }
})
test('?openrouter_key gives a key, false for none at all, and nothing otherwise', () => {
  expect(readAiSettings('').openrouter_key).toBeUndefined()
  expect(readAiSettings('?openrouter_key=sk-or-v1-test').openrouter_key).toBe('sk-or-v1-test')
  expect(readAiSettings('?openrouter_key=false').openrouter_key).toBe(false)
  expect(readAiSettings('?openrouter_key=0').openrouter_key).toBe(false)
  for (const value of ['', '%20', 'true', '1']) {
    expect(readAiSettings(`?openrouter_key=${value}`).openrouter_key).toBeUndefined()
  }
})
test('a key from ?openrouter_key never shows in the query overrides that telemetry records', () => {
  expect(readQueryOverrides('http://localhost/?openrouter_key=sk-or-v1-test')).toEqual({openrouter_key: 'redacted'})
  expect(readQueryOverrides('http://localhost/?openrouter_key=false&openrouter_host=openrouter.nas.lan')).toEqual({
    openrouter_host: 'https://openrouter.nas.lan',
    openrouter_key: false,
  })
})
test('?ai=false disables AI, while a missing parameter keeps it on', () => {
  expect(readAiSettings('?ai=false').ai).toBe(false)
  expect(readAiSettings('').ai).toBe(true)
})
test('settings changes cannot switch AI back on when the page disabled it', () => {
  const params = readAiSettings('?ai=false')
  expect(patchAiSettings(params, {ai: true}, false).ai).toBe(false)
  expect(patchAiSettings(params, {narrator_voice: 'other'}, false)).toMatchObject({
    ai: false,
    narrator_voice: 'other',
  })
  const enabled = readAiSettings('')
  expect(patchAiSettings(enabled, {ai: false}, true).ai).toBe(false)
  const disabled = {
    ...enabled,
    ai: false,
  }
  expect(patchAiSettings(disabled, {ai: true}, true).ai).toBe(true)
  expect(patchAiSettings(enabled, {eager_audio: true}, true).ai).toBe(true)
})
// The menu after the intro, which leaves out the AI options either way. Server rendering reads the store’s initial state.
const renderMenu = (available: boolean) => {
  const {orbit} = useIntro.getInitialState()
  Object.assign(useIntro.getInitialState(), {orbit: null})
  try {
    return renderToStaticMarkup(<GraphicsModeProvider isHeavy onChange={() => {}}><Menu available={available} params={readAiSettings(available ? '' : '?ai=false')} setParams={() => {}} /></GraphicsModeProvider>)
  } finally {
    Object.assign(useIntro.getInitialState(), {orbit})
  }
}
test('the menu hides every AI option for ?ai=false', () => {
  const hidden = renderMenu(false)
  expect(hidden).not.toContain('data-testid="connection"')
  expect(hidden).not.toContain('OpenRouter')
  expect(hidden).not.toContain('API key')
  expect(hidden).not.toContain('Enable AI')
  expect(hidden).not.toContain('type="password"')
  expect(hidden).toContain('Mute audio')
  expect(hidden).toContain('Heavy graphics')
  const shown = renderMenu(true)
  expect(shown).toContain('data-testid="connection"')
  expect(shown).toContain('API key')
})
test('?openrouter_key=false locks the key input and connects through the host alone', () => {
  const settings = readAiSettings('?openrouter_host=openrouter.nas.lan&openrouter_key=false')
  const html = renderToStaticMarkup(<OpenRouterConnection available params={settings} setParams={() => {}} />)
  expect(html).toMatch(/<input[^>]*\bid="settings-key"[^>]*\bdisabled=""/u)
  expect(html).toContain('placeholder="Added by openrouter.nas.lan"')
  expect(html).toContain('Enabled')
  expect(html).toContain('Enable AI')
  expect(html).not.toContain('Disconnect')
  const plain = renderToStaticMarkup(<OpenRouterConnection available params={readAiSettings('')} setParams={() => {}} />)
  expect(plain).not.toMatch(/<input[^>]*\bdisabled=""/u)
  expect(plain).toContain('Not connected')
  expect(plain).toContain('only goes to OpenRouter')
})
