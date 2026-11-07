import type {AiSettings} from './ai/settings.ts'
import type {Portrait, ThrownItem} from './gallery.ts'
import type {FusionImpact} from './gallery/fusion/Fusion.ts'

import {useEffect, useState} from 'react'

import GalleryDirector from './ai/GalleryDirector.ts'
import {patchAiSettings, readAiSettings} from './ai/settings.ts'
import {attachNarration} from './audio/narration.ts'
import SoundEngine from './audio/SoundEngine.ts'
import {galleryEvents, notify, useGallery} from './gallery.ts'

export default function useGalleryAI() {
  useEffect(attachNarration, [])
  const [params, setParamsState] = useState<AiSettings>(() => readAiSettings())
  // `?ai=false` turns AI off for the whole page, unlike the in-menu toggle, which can turn it back on.
  const [available] = useState(() => params.ai)
  const setParams = (patch: Partial<AiSettings>) => setParamsState(current => patchAiSettings(current, patch, available))
  const key = useGallery(s => s.apiKey)
  useEffect(() => {
    useGallery.setState({ai: params.ai})
  }, [params.ai])
  useEffect(() => {
    const director = new GalleryDirector(params, {
      origin: params.openrouter_host,
      // `?openrouter_key=false` leaves the key to the host.
      key: params.openrouter_key === false ? false : key,
    })
    const imported = (event: Event) => void director.flavor((event as CustomEvent<Portrait>).detail).catch(() => notify('The label could not be prepared.'))
    const narrate = (event: Event) => {
      director.narrator.enqueue((event as CustomEvent<string>).detail)
    }
    const fuse = (event: Event) => {
      const [a, b, impact] = (event as CustomEvent<[string, string, FusionImpact | undefined]>).detail
      void director.fuse(a, b, impact).catch(() => notify('The fusion could not be started.'))
    }
    const fuseItem = (event: Event) => {
      const {portrait, item, impact} = (event as CustomEvent<{
        impact?: FusionImpact
        item: ThrownItem
        portrait: string
      }>).detail
      void director.fuseItem(portrait, item, impact).catch(() => notify('The fusion could not be started.'))
    }
    const unsubscribe = useGallery.subscribe(s => {
      SoundEngine.existing()?.mute(!s.sound)
    })
    galleryEvents.addEventListener('imported', imported)
    galleryEvents.addEventListener('narrate', narrate)
    galleryEvents.addEventListener('fusion', fuse)
    galleryEvents.addEventListener('item-fusion', fuseItem)
    return () => {
      unsubscribe()
      galleryEvents.removeEventListener('imported', imported)
      galleryEvents.removeEventListener('narrate', narrate)
      galleryEvents.removeEventListener('fusion', fuse)
      galleryEvents.removeEventListener('item-fusion', fuseItem)
      director.dispose()
    }
  }, [key, params.openrouter_host, params.openrouter_key, params.ai, params.ai_tier, params.text_model, params.text_model_effort, params.image_model, params.audio_model, params.stt_model, params.narrator_voice, params.narrator_character, params.eager_audio])
  return {
    /** whether the page allows AI at all; `false` for `?ai=false`, which also hides every AI option */
    available,
    params,
    setParams,
  }
}
