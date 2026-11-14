import {narrationState, Narrator} from 'use-narrator/core'

import {galleryEvents, notify} from '../gallery/actions.ts'
import {useGallery} from '../gallery/store.ts'
import worldClock from '../worldClock.ts'
import {narrationMeter} from './NarrationMeter.ts'
import SoundEngine from './SoundEngine.ts'

/** The one application-owned narrator. Timing values are seconds. */
export const narrator = new Narrator({
  enabled: false,
  gap: 0.15,
  prependedSilence: 0.12,
  appendedSilence: 0.5,
  audio: {
    volume: 0.85,
    prepare: () => SoundEngine.get().resume(),
    // An offline context, like a film’s, can’t take media elements, so recordings play through it decoded.
    context: () => {
      const {context} = SoundEngine.get()
      return 'createMediaElementSource' in context ? undefined : context
    },
    connect: (audio, instanceId) => {
      const {context, output} = SoundEngine.get()
      return narrationMeter.connect(instanceId, audio, context, output)
    },
  },
  onError: error => notify(Error.isError(error) ? error.message : 'The narration could not be played.'),
  onFallback: () => notify('The recorded voice is unavailable. Using the browser voice instead.'),
})

/** Gallery-specific mute, pause, navigation and telemetry projection. Playback state lives in the package. */
export function attachNarration(target: Narrator = narrator, events: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> = globalThis) {
  target.enabled = useGallery.getState().sound
  // The narrator falls silent mid-word while the world is frozen and speaks on from there once it goes on.
  const followWorld = () => {
    if (worldClock.frozen) {
      target.pause()
    } else {
      target.resume()
    }
  }
  const unsubscribeWorld = worldClock.subscribe(followWorld)
  followWorld()
  const publish = () => {
    const next = narrationState(target.getSnapshot())
    // Queued, preparing or canceled stories do not count as listened to.
    if (next?.status === 'playing') {
      useGallery.getState().markInteracted(next.id)
    }
    const previous = useGallery.getState().narration
    if (next?.id !== previous?.id || next?.title !== previous?.title || next?.text !== previous?.text || next?.source !== previous?.source || next?.status !== previous?.status) {
      useGallery.setState({narration: next})
    }
  }
  const unsubscribeNarrator = target.subscribe(publish)
  const unsubscribeGallery = useGallery.subscribe((state, previous) => {
    if (state.sound !== previous.sound) {
      target.enabled = state.sound
    }
  })
  const stop = () => target.stop()
  galleryEvents.addEventListener('stop-narration', stop)
  galleryEvents.addEventListener('teleport', stop)
  events.addEventListener('pagehide', stop)
  publish()
  return () => {
    unsubscribeWorld()
    target.resume()
    unsubscribeGallery()
    galleryEvents.removeEventListener('stop-narration', stop)
    galleryEvents.removeEventListener('teleport', stop)
    events.removeEventListener('pagehide', stop)
    target.enabled = false
    unsubscribeNarrator()
  }
}

// Bun’s types claim import.meta.hot always exists, but outside the Vite dev server it is undefined.
if (import.meta.hot as ImportMeta['hot'] | undefined) {
  import.meta.hot.dispose(() => narrator.dispose())
}
