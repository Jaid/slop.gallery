import type useGalleryAI from '#src/lib/useGalleryAI.ts'

import Branch from 'branch-component'
import {useState} from 'react'

import {openRouterOrigin} from '#src/lib/ai/openRouterAccess.ts'
import {notify, setApiKey, useGallery} from '#src/lib/gallery.ts'

import css from './style.module.sass'

export default function OpenRouterConnection({params, setParams}: ReturnType<typeof useGalleryAI>) {
  const apiKey = useGallery(s => s.apiKey)
  const [key, setKey] = useState(apiKey)
  // Another host than OpenRouter, like a proxy, never gets the key and adds its own.
  const keyless = params.openrouter_host !== openRouterOrigin
  const connected = keyless || !!apiKey
  const origin = new URL(params.openrouter_host)
  const host = keyless ? origin.host : 'OpenRouter'
  return <section className={css.container} aria-labelledby='openrouter-title' data-testid='connection'>
    <h2 id='openrouter-title'>OpenRouter <span>{connected ? (params.ai ? 'Enabled' : 'Disabled') : 'Not connected'}</span></h2>
    <p>Optional AI for artwork titles, stories and fusions. Images and text are sent to {host} and may incur charges. No key is needed to explore.</p>
    <form
      onSubmit={event => {
        event.preventDefault()
        if (keyless || !key.trim()) {
          return
        }
        setApiKey(key.trim())
        setParams({ai: true})
        notify('OpenRouter key saved in this browser. AI is enabled.')
      }}
    >
      <label htmlFor='settings-key'>API key</label>
      <div className={css.keyRow}><input id='settings-key' autoComplete='off' disabled={keyless} placeholder={keyless ? `Added by ${host}` : 'sk-or-…'} spellCheck={false} type='password' value={keyless ? '' : key} onChange={event => setKey(event.target.value)} /><button className={css.primaryButton} disabled={keyless || !key.trim()} type='submit'>{apiKey ? 'Update' : 'Connect'}</button></div>
    </form>
    <p className={css.note}>{keyless ? `Requests go to ${host} without a key, and it adds its own.` : `Your key stays in this browser and only goes to ${host}. Saving a key does not verify it or make a paid request.`}</p>
    <Branch if={connected}><div>
      <label className={css.toggleRow}>Enable AI<input checked={params.ai} type='checkbox' onChange={event => setParams({ai: event.target.checked})} /></label>
      <Branch not={keyless}><button
        className={css.textButton} type='button' onClick={() => {
          setApiKey('')
          setKey('')
          setParams({ai: false})
          notify('Key removed. AI is off.')
        }}
      >Disconnect & forget key</button></Branch>
    </div></Branch>
  </section>
}
