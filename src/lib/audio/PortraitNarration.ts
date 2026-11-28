import type {OpenRouterAccess} from '../ai/openRouterAccess.ts'
import type {AiSettings} from '../ai/settings.ts'
import type {Portrait} from '../gallery/types.ts'
import type {AudioHandle, Narrator} from 'use-narrator/core'

import {noop} from 'es-toolkit'
import {SpeechCache} from 'use-narrator/core'

import withMinimumTime from '../ai/minimumTime.ts'
import NarrationAligner from '../ai/NarrationAligner.ts'
import NarrationGenerator from '../ai/NarrationGenerator.ts'
import {hasAccess} from '../ai/openRouterAccess.ts'
import {tieredModel} from '../ai/settings.ts'
import {notify} from '../gallery/actions.ts'
import {isTellable} from '../gallery/portraitFlavor.ts'
import {useGallery} from '../gallery/store.ts'
import {environmentSeed} from '../gameSeed.ts'
import {intro} from './intro.ts'
import {narrator} from './narration.ts'
import {narratorCharacter, narratorVoice} from './narratorCharacter.ts'
import transcriptFor from './transcript.ts'

type Story = Pick<Portrait, 'description' | 'id' | 'title'> & Partial<Pick<Portrait, 'fusing' | 'narration' | 'pending' | 'source'>>
type Request = {
  controller: AbortController
  handle?: AudioHandle
  story?: Story
}
function storyFor(id: string): Story | undefined {
  return id === intro.id ? intro : useGallery.getState().portraits.find(p => p.id === id)
}
function waitForStory(id: string, signal: AbortSignal): Promise<Story> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let unsubscribe = noop
    const abort = () => {
      unsubscribe()
      signal.removeEventListener('abort', abort)
      reject(signal.reason)
    }
    const check = () => {
      const story = storyFor(id)
      if (!story) {
        unsubscribe()
        signal.removeEventListener('abort', abort)
        reject(new Error('The artwork no longer exists.'))
      } else if (!story.pending && !story.fusing) {
        unsubscribe()
        signal.removeEventListener('abort', abort)
        resolve(story)
      }
    }
    unsubscribe = useGallery.subscribe(check)
    signal.addEventListener('abort', abort, {once: true})
    if (signal.aborted) {
      abort()
    } else {
      check()
    }
  })
}

/** Portrait-specific label readiness and generation policy; no audio elements, UI state or playback scheduling. */
export default class PortraitNarration {
  private cache: SpeechCache
  private lifetime = new AbortController
  private requests = new Map<string, Request>
  private unsubscribe: () => void

  constructor(private readonly settings: AiSettings, private readonly access: OpenRouterAccess, private readonly target: Narrator = narrator) {
    const generator = new NarrationGenerator(access, tieredModel(settings.audio_model, settings.ai_tier), settings.narrator_voice ?? narratorVoice(environmentSeed))
    const character = settings.narrator_character ?? narratorCharacter(environmentSeed)
    const aligner = settings.stt_model === false ? undefined : new NarrationAligner(access, settings.stt_model)
    this.cache = new SpeechCache(async (speech, signal) => {
      const speaking = AbortSignal.any([signal, AbortSignal.timeout(90_000)])
      // Only the speech is held back, the alignment after it isn’t.
      const audio = await withMinimumTime(generator.generate(speech.text, {
        signal: speaking,
        character,
      }), settings.request_minimum_time, speaking)
      if (!aligner) {
        return audio
      }
      // Subtitles follow the words when this works and fall back to an estimate when it doesn’t, so it never holds the narration back for long.
      try {
        return {
          audio,
          timing: await aligner.align(audio, speech.text, {signal: AbortSignal.any([signal, AbortSignal.timeout(8000)])}),
        }
      } catch (error) {
        signal.throwIfAborted()
        console.warn('The narration could not be aligned for subtitles.', error)
        return audio
      }
    })
    this.unsubscribe = useGallery.subscribe(() => {
      for (const [id, request] of this.requests) {
        const current = storyFor(id)
        const previous = request.story
        if (!current || previous && (current.title !== previous.title || current.description !== previous.description || current.source !== previous.source || current.narration !== previous.narration || current.pending || current.fusing)) {
          request.controller.abort('Artwork changed')
        }
      }
    })
  }

  dispose() {
    this.unsubscribe()
    this.stop()
    this.lifetime.abort()
    this.cache.dispose()
  }

  /** Reads the story of the work with the id, or of the intro, as soon as its label is done; a work with nothing to read and no flavor text on its way is left unread. */
  enqueue(id: string): AudioHandle | undefined {
    const story = storyFor(id)
    if (!story || !useGallery.getState().sound || this.lifetime.signal.aborted || !isTellable(story) && !story.pending && !story.fusing) {
      return
    }
    const existing = this.requests.get(id)
    if (existing?.handle && !existing.controller.signal.aborted && this.target.queue.has(existing.handle.id)) {
      return existing.handle
    }
    const request: Request = {controller: new AbortController}
    this.requests.set(id, request)
    const handle = this.target.push(async signal => {
      const ready = await waitForStory(id, signal)
      signal.throwIfAborted()
      // A flavor text that failed leaves nothing to read, which goes without a word, as the failure told already.
      if (!isTellable(ready)) {
        request.controller.abort('Nothing to read')
        signal.throwIfAborted()
        throw new Error('The artwork has nothing to read.')
      }
      request.story = ready
      const text = transcriptFor(ready)
      return ready.narration ? {
        ...ready.narration,
        title: ready.title,
        text,
      } : {
        text,
        title: ready.title,
        rate: 0.91,
        synthesize: this.settings.ai && hasAccess(this.access) ? this.cache.synthesize : 'browser' as const,
      }
    }, {
      id,
      title: story.title,
      key: `portrait:${id}`,
      signal: AbortSignal.any([this.lifetime.signal, request.controller.signal]),
    })
    request.handle = handle
    void handle.finished.then(() => {
      if (this.requests.get(id) === request) {
        this.requests.delete(id)
      }
    }).catch(error => {
      console.error('Portrait narration cleanup failed.', error)
    })
    return handle
  }

  /** Waiting jobs observe label completion directly. This hook is only for optional eager generation. */
  ready(id: string) {
    const story = storyFor(id)
    if (!story || !isTellable(story) || !this.settings.eager_audio || !this.settings.ai || !hasAccess(this.access) || !useGallery.getState().sound || story.narration || story.pending || story.fusing || this.lifetime.signal.aborted) {
      return
    }
    void this.cache.synthesize({
      text: transcriptFor(story),
      rate: 0.91,
    }, this.lifetime.signal).catch(() => {
      if (!this.lifetime.signal.aborted) {
        notify('The story could not be prepared.')
      }
    })
  }

  stop() {
    for (const request of this.requests.values()) {
      request.controller.abort()
    }
    this.requests.clear()
  }
}
